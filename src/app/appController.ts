import { appState } from "./appState.ts";
import { apiClient } from "../api/apiClient.ts";
import { LibraryView } from "../library/libraryView.ts";
import { StoreView } from "../store/storeView.ts";
import { BookRenderer } from "../book/bookRenderer.ts";
import { processFile } from "../import/fileUpload.ts";
import { extractEPUBFromBuffer } from "../import/epubExtractor.ts";
import { BookCreateInput } from "../types/book.ts";
import { CatalogBookItem } from "../types/catalog.ts";

export class AppController {
  private container: HTMLElement;
  private currentRenderer: BookRenderer | null = null;
  private libraryView: LibraryView | null = null;
  private storeView: StoreView | null = null;
  private bottomNav: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private init(): void {
    this.createBottomNav();

    appState.subscribe(async (state) => {
      this.updateBottomNav(state.currentView);

      if (state.currentView === "library") {
        await this.renderLibrary();
      } else if (state.currentView === "store") {
        await this.renderStore();
      } else if (state.currentView === "reader" && state.currentBookId) {
        await this.renderReader(state.currentBookId);
      }
    });

    // Vista inicial
    this.renderLibrary();
  }

  private createBottomNav(): void {
    let existing = document.getElementById("appBottomNav");
    if (existing) existing.remove();

    const nav = document.createElement("nav");
    nav.id = "appBottomNav";
    nav.className = "bottom-nav-bar";
    nav.innerHTML = `
      <button class="bottom-nav-item active" data-nav="library" aria-label="Ir a Mi Biblioteca">
        <span class="bottom-nav-icon">📚</span>
        <span class="bottom-nav-label">Mi Biblioteca</span>
      </button>
      <button class="bottom-nav-item" data-nav="store" aria-label="Ir a Explorar Tienda">
        <span class="bottom-nav-icon">🌐</span>
        <span class="bottom-nav-label">Explorar Tienda</span>
      </button>
    `;

    nav.querySelectorAll(".bottom-nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-nav") as "library" | "store";
        if (target) {
          appState.setState({ currentView: target });
        }
      });
    });

    document.body.appendChild(nav);
    this.bottomNav = nav;
  }

  private updateBottomNav(currentView: "library" | "reader" | "store"): void {
    if (!this.bottomNav) return;

    if (currentView === "reader") {
      this.bottomNav.classList.add("hidden");
    } else {
      this.bottomNav.classList.remove("hidden");
      this.bottomNav.querySelectorAll(".bottom-nav-item").forEach((btn) => {
        if (btn.getAttribute("data-nav") === currentView) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  }

  private async renderLibrary(): Promise<void> {
    if (this.currentRenderer) {
      this.currentRenderer.destroy();
      this.currentRenderer = null;
    }
    this.storeView = null;

    this.libraryView = new LibraryView(this.container, {
      onOpenBook: (bookId) => {
        appState.setState({ currentView: "reader", currentBookId: bookId });
      },
      onImportFile: async (file: File) => {
        await this.handleFileImport(file);
      },
      onCreateManual: async (input: BookCreateInput) => {
        await this.handleManualCreate(input);
      },
    });

    await this.libraryView.render();
  }

  private async renderStore(): Promise<void> {
    if (this.currentRenderer) {
      this.currentRenderer.destroy();
      this.currentRenderer = null;
    }
    this.libraryView = null;

    this.storeView = new StoreView(this.container, {
      onImportBook: async (book: CatalogBookItem, openDirectly: boolean) => {
        await this.handleStoreBookImport(book, openDirectly);
      },
      onBackToLibrary: () => {
        appState.setState({ currentView: "library" });
      },
      showToast: (msg, type) => {
        this.showToast(msg, type);
      },
    });

    await this.storeView.render();
  }

  private async renderReader(bookId: string): Promise<void> {
    this.libraryView = null;
    this.storeView = null;

    const book = await apiClient.getBook(bookId);
    if (!book) {
      this.showToast("No se pudo encontrar el libro seleccionado", "error");
      appState.setState({ currentView: "library", currentBookId: null });
      return;
    }

    this.currentRenderer = new BookRenderer(this.container, book, {
      onBackToLibrary: () => {
        appState.setState({ currentView: "library", currentBookId: null });
      },
      onProgressUpdate: async (id, current, total, percentage, timeSecs) => {
        await apiClient.updateProgress(id, current, total, percentage, timeSecs);
      },
    });

    await this.currentRenderer.render();
  }

  private async handleStoreBookImport(book: CatalogBookItem, openDirectly: boolean): Promise<void> {
    this.showToast(`Descargando "${book.title}"...`, "info");

    try {
      // 1. Descargar EPUB ArrayBuffer desde proxy backend
      const arrayBuffer = await apiClient.downloadCatalogBookBuffer(book.id);

      // 2. Extraer capítulos y portada mediante JSZip
      const authorsStr = book.authors.join(", ") || "Autor desconocido";
      const extracted = await extractEPUBFromBuffer(arrayBuffer, book.title, authorsStr);

      // 3. Crear libro en base de datos
      const created = await apiClient.createBook({
        title: extracted.title || book.title,
        author: extracted.author || authorsStr,
        format: "epub",
        content: extracted.content,
        cover_url: book.cover_url || extracted.cover_url,
        total_pages_estimated: extracted.total_pages_estimated,
      });

      this.showToast(`✓ "${created.title}" añadido a tu biblioteca`, "success");

      // 4. Si el usuario eligió "Leer Ahora", transicionar directamente al lector
      if (openDirectly) {
        appState.setState({ currentView: "reader", currentBookId: created.id });
      }
    } catch (err: any) {
      console.error("Error importando libro desde catálogo:", err);
      throw new Error(err.message || "No se pudo descargar e importar el libro.");
    }
  }

  private async handleFileImport(file: File): Promise<void> {
    this.showToast(`Importando ${file.name}...`, "info");

    try {
      const extracted = await processFile(file);
      const createdBook = await apiClient.createBook(extracted);
      this.showToast(`✓ "${createdBook.title}" añadido a tu biblioteca`, "success");

      if (this.libraryView) {
        await this.libraryView.loadData();
      }
    } catch (err: any) {
      console.error("Error importando archivo:", err);
      this.showToast(err.message || "Error al procesar el archivo", "error");
    }
  }

  private async handleManualCreate(input: BookCreateInput): Promise<void> {
    try {
      const created = await apiClient.createBook(input);
      this.showToast(`✓ Apunte "${created.title}" creado con éxito`, "success");
      appState.setState({ currentView: "reader", currentBookId: created.id });
    } catch (err: any) {
      console.error("Error creando apunte:", err);
      this.showToast("Error al guardar el apunte", "error");
    }
  }

  private showToast(message: string, type: "info" | "success" | "error" = "info"): void {
    let toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("toast-fade-out");
      window.setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }
}
