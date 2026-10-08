import {
  Book,
  BookDetail,
  BookCreateInput,
  Annotation,
} from "../types/book.ts";
import { CatalogSearchParams, CatalogSearchResponse } from "../types/catalog.ts";
import { localDB } from "../storage/database.ts";

const API_BASE = "/api";

export class ApiClient {
  private isOnlineCache: boolean | null = null;
  private lastCheckTime = 0;

  async isBackendAvailable(): Promise<boolean> {
    const now = Date.now();
    // Cache de chequeo por 5 segundos para evitar spam de peticiones
    if (this.isOnlineCache !== null && now - this.lastCheckTime < 5000) {
      return this.isOnlineCache;
    }

    try {
      const res = await fetch(`${API_BASE}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2000),
      });
      this.isOnlineCache = res.ok;
    } catch {
      this.isOnlineCache = false;
    }

    this.lastCheckTime = now;
    return this.isOnlineCache;
  }

  // --- Libros ---
  async listBooks(search?: string, isFavorite?: boolean): Promise<Book[]> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (isFavorite !== undefined)
          params.append("is_favorite", String(isFavorite));

        const res = await fetch(`${API_BASE}/books?${params.toString()}`);
        if (res.ok) {
          const books: Book[] = await res.json();
          return books;
        }
      } catch (err) {
        console.warn("Fallo al listar desde API, usando almacenamiento local:", err);
      }
    }

    // Fallback Local
    let localBooks = await localDB.getAllBooks();
    if (search) {
      const q = search.toLowerCase();
      localBooks = localBooks.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q)
      );
    }
    if (isFavorite !== undefined) {
      localBooks = localBooks.filter((b) => b.is_favorite === isFavorite);
    }
    return localBooks;
  }

  async getBook(id: string): Promise<BookDetail | null> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/books/${id}`);
        if (res.ok) {
          const book: BookDetail = await res.json();
          // Actualizar caché local
          await localDB.saveBook(book);
          return book;
        }
      } catch (err) {
        console.warn("Fallo al obtener libro de API:", err);
      }
    }

    return await localDB.getBook(id);
  }

  async createBook(input: BookCreateInput): Promise<BookDetail> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/books`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (res.ok) {
          const book: BookDetail = await res.json();
          await localDB.saveBook(book);
          return book;
        }
      } catch (err) {
        console.warn("Fallo al enviar libro a API, guardando en local:", err);
      }
    }

    // Creación local si el backend no está disponible
    const localId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newBook: BookDetail = {
      id: localId,
      title: input.title,
      author: input.author || "Desconocido",
      format: input.format || "txt",
      cover_url: input.cover_url || null,
      content: input.content,
      total_pages_estimated: input.total_pages_estimated || 1,
      is_favorite: false,
      is_finished: false,
      created_at: now,
      updated_at: now,
      progress: {
        book_id: localId,
        current_page: 0,
        total_pages: input.total_pages_estimated || 1,
        percentage: 0,
        reading_time_seconds: 0,
        last_read_at: now,
      },
    };

    await localDB.saveBook(newBook);
    if (newBook.progress) {
      await localDB.saveProgress(newBook.progress);
    }
    return newBook;
  }

  async deleteBook(id: string): Promise<void> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        await fetch(`${API_BASE}/books/${id}`, { method: "DELETE" });
      } catch (err) {
        console.warn("Fallo al eliminar libro en API:", err);
      }
    }

    await localDB.deleteBook(id);
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/books/${id}/favorite`, {
          method: "PATCH",
        });
        if (res.ok) {
          const updated: Book = await res.json();
          const local = await localDB.getBook(id);
          if (local) {
            local.is_favorite = updated.is_favorite;
            await localDB.saveBook(local);
          }
          return updated.is_favorite;
        }
      } catch (err) {
        console.warn("Fallo toggle favorite en API:", err);
      }
    }

    // Modo local
    const local = await localDB.getBook(id);
    if (local) {
      local.is_favorite = !local.is_favorite;
      await localDB.saveBook(local);
      return local.is_favorite;
    }
    return false;
  }

  async toggleFinished(id: string): Promise<boolean> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/books/${id}/finished`, {
          method: "PATCH",
        });
        if (res.ok) {
          const updated: Book = await res.json();
          const local = await localDB.getBook(id);
          if (local) {
            local.is_finished = updated.is_finished;
            await localDB.saveBook(local);
          }
          return updated.is_finished;
        }
      } catch (err) {
        console.warn("Fallo toggle finished en API:", err);
      }
    }

    const local = await localDB.getBook(id);
    if (local) {
      local.is_finished = !local.is_finished;
      await localDB.saveBook(local);
      return local.is_finished;
    }
    return false;
  }

  // --- Progreso ---
  async updateProgress(
    bookId: string,
    currentPage: number,
    totalPages: number,
    percentage: number,
    readingTimeSeconds: number
  ): Promise<void> {
    const payload = {
      current_page: currentPage,
      total_pages: totalPages,
      percentage: Number(percentage.toFixed(1)),
      reading_time_seconds: readingTimeSeconds,
    };

    const isOnline = await this.isBackendAvailable();
    if (isOnline) {
      try {
        await fetch(`${API_BASE}/books/${bookId}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn("Fallo guardando progreso en API:", err);
      }
    }

    // Guardado local garantizado
    await localDB.saveProgress({
      book_id: bookId,
      current_page: currentPage,
      total_pages: totalPages,
      percentage: Number(percentage.toFixed(1)),
      reading_time_seconds: readingTimeSeconds,
      last_read_at: new Date().toISOString(),
    });
  }

  async getLatestReading(): Promise<Book | null> {
    const isOnline = await this.isBackendAvailable();

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/progress/latest`);
        if (res.ok) {
          const book: Book | null = await res.json();
          if (book) return book;
        }
      } catch (err) {
        console.warn("Fallo al obtener lectura reciente en API:", err);
      }
    }

    // Fallback local
    const latestProgress = await localDB.getLatestProgress();
    if (latestProgress) {
      const book = await localDB.getBook(latestProgress.book_id);
      if (book) {
        book.progress = latestProgress;
        return book;
      }
    }

    // Fallback al primer libro si hay alguno
    const all = await localDB.getAllBooks();
    return all.length > 0 ? all[0] : null;
  }

  // --- Anotaciones ---
  async listAnnotations(bookId: string): Promise<Annotation[]> {
    const isOnline = await this.isBackendAvailable();
    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/books/${bookId}/annotations`);
        if (res.ok) {
          const items: Annotation[] = await res.json();
          // Sincronizar en local
          for (const item of items) {
            await localDB.saveAnnotation(item);
          }
          return items;
        }
      } catch (err) {
        console.warn("Fallo al listar anotaciones de API:", err);
      }
    }
    return await localDB.getAnnotationsByBook(bookId);
  }

  async createAnnotation(
    bookId: string,
    pageNumber: number,
    selectedText: string,
    color: string,
    note?: string
  ): Promise<Annotation> {
    const isOnline = await this.isBackendAvailable();
    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/books/${bookId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_number: pageNumber,
            selected_text: selectedText,
            color,
            note,
          }),
        });
        if (res.ok) {
          const created: Annotation = await res.json();
          await localDB.saveAnnotation(created);
          return created;
        }
      } catch (err) {
        console.warn("Fallo al crear anotación en API:", err);
      }
    }

    // Modo local
    const localAnnotation: Annotation = {
      id: crypto.randomUUID(),
      book_id: bookId,
      page_number: pageNumber,
      selected_text: selectedText,
      color,
      note: note || null,
      created_at: new Date().toISOString(),
    };
    await localDB.saveAnnotation(localAnnotation);
    return localAnnotation;
  }

  async updateAnnotation(
    annotationId: string,
    note?: string | null,
    color?: string | null
  ): Promise<void> {
    const isOnline = await this.isBackendAvailable();
    if (isOnline) {
      try {
        await fetch(`${API_BASE}/annotations/${annotationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note, color }),
        });
      } catch (err) {
        console.warn("Fallo al actualizar anotación en API:", err);
      }
    }
    await localDB.updateAnnotation(annotationId, note, color);
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    const isOnline = await this.isBackendAvailable();
    if (isOnline) {
      try {
        await fetch(`${API_BASE}/annotations/${annotationId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.warn("Fallo al eliminar anotación en API:", err);
      }
    }
    await localDB.deleteAnnotation(annotationId);
  }

  // --- Catálogo / Tienda Gutenberg ---
  async searchCatalog(params: CatalogSearchParams = {}, signal?: AbortSignal): Promise<CatalogSearchResponse> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set("search", params.search);
    if (params.language) searchParams.set("language", params.language);
    if (params.topic) searchParams.set("topic", params.topic);
    if (params.page) searchParams.set("page", String(params.page));

    const res = await fetch(`${API_BASE}/catalog/search?${searchParams.toString()}`, { signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al buscar libros en el catálogo");
    }
    return await res.json();
  }

  async downloadCatalogBookBuffer(bookId: number): Promise<ArrayBuffer> {
    const res = await fetch(`${API_BASE}/catalog/download/${bookId}`);
    if (!res.ok) {
      throw new Error(`Error al descargar el libro ${bookId} desde el catálogo`);
    }
    return await res.arrayBuffer();
  }
}

export const apiClient = new ApiClient();
