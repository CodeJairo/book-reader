import { CatalogBookItem, CatalogSearchResponse } from "../types/catalog.ts";
import { apiClient } from "../api/apiClient.ts";
import { localDB } from "../storage/database.ts";
import { generateBookCover } from "../library/coverGenerator.ts";

export interface StoreViewCallbacks {
  onImportBook: (book: CatalogBookItem, openDirectly: boolean) => Promise<void>;
  onBackToLibrary: () => void;
  showToast: (message: string, type: "info" | "success" | "error") => void;
}

interface FilterChip {
  id: string;
  label: string;
  language?: string;
  topic?: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { id: "es", label: "🇪🇸 En Español", language: "es" },
  { id: "all", label: "🌍 Todos los Idiomas", language: "all" },
  { id: "en", label: "🇬🇧 En Inglés", language: "en" },
  { id: "fiction", label: "🕵️ Ficción", topic: "fiction" },
  { id: "philosophy", label: "🧠 Filosofía", topic: "philosophy" },
  { id: "history", label: "📜 Historia", topic: "history" },
  { id: "poetry", label: "✍️ Poesía", topic: "poetry" },
];

export class StoreView {
  private container: HTMLElement;
  private callbacks: StoreViewCallbacks;
  private books: CatalogBookItem[] = [];
  private totalCount = 0;
  private currentPage = 1;
  private hasNext = false;
  private isLoading = false;
  private abortController: AbortController | null = null;
  private activeChipId = "es";
  private searchQuery = "";
  private searchDebounceTimer: number | null = null;
  private selectedBook: CatalogBookItem | null = null;
  private importedBookIds: Set<number> = new Set();

  constructor(container: HTMLElement, callbacks: StoreViewCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  async render(): Promise<void> {
    const settings = await localDB.getSettings();
    const currentTheme = settings.theme || "claro";

    this.container.innerHTML = `
      <div class="store-page">
        <!-- Top Navigation Header -->
        <header class="store-header">
          <div class="header-top-bar">
            <div class="header-branding">
              <span class="app-icon">🌐</span>
              <div>
                <h1>Explorar Libros Gratuitos</h1>
                <p class="header-subtitle">+70,000 obras del dominio público (Project Gutenberg)</p>
              </div>
            </div>

            <!-- Selector de Temas en la Página Principal -->
            <div class="header-theme-selector" title="Cambiar tema visual">
              <button class="btn-theme-pill ${currentTheme === "claro" ? "active" : ""}" data-theme-btn="claro" title="Tema Claro">⚪</button>
              <button class="btn-theme-pill ${currentTheme === "sepia" ? "active" : ""}" data-theme-btn="sepia" title="Tema Sepia">📜</button>
              <button class="btn-theme-pill ${currentTheme === "oscuro" ? "active" : ""}" data-theme-btn="oscuro" title="Tema Oscuro">⚫</button>
            </div>
          </div>

          <!-- Buscador y Categorías -->
          <div class="store-search-section">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="storeSearchInput" placeholder="Buscar por título, autor o palabra clave..." value="${this.searchQuery}" />
            </div>

            <!-- Chips de Filtro Rápido -->
            <div class="store-chips-scroll">
              ${FILTER_CHIPS.map(
                (c) => `
                <button class="store-chip ${c.id === this.activeChipId ? "active" : ""}" data-chip-id="${c.id}">
                  ${c.label}
                </button>
              `
              ).join("")}
            </div>
          </div>
        </header>

        <!-- Contador y Estado -->
        <div class="store-status-bar">
          <span id="storeResultsCount" class="store-results-text">Cargando catálogo...</span>
        </div>

        <!-- Grid de Libros del Catálogo -->
        <div id="storeBooksGrid" class="store-books-grid">
          <div class="store-loading-spinner">
            <div class="spinner-circle"></div>
            <p>Conectando con Project Gutenberg...</p>
          </div>
        </div>

        <!-- Botón Cargar Más Libros (Mobile-First Pagination) -->
        <div id="storeLoadMoreWrapper" class="store-load-more-wrapper hidden">
          <button id="btnStoreLoadMore" class="btn-secondary btn-load-more">
            ⬇ Cargar más libros...
          </button>
        </div>

        <!-- Modal / Ficha Detallada del Libro -->
        <div id="storeBookModal" class="modal-overlay hidden">
          <div class="modal-backdrop"></div>
          <div class="modal-card store-modal-card">
            <div class="modal-header">
              <div class="modal-header-info">
                <span class="modal-header-icon">📖</span>
                <div>
                  <h3 class="modal-title" id="modalBookTitle">Detalle de la Obra</h3>
                  <p class="modal-subtitle" id="modalBookAuthor">Project Gutenberg</p>
                </div>
              </div>
              <button id="btnCloseStoreModal" class="btn-icon" aria-label="Cerrar modal">✕</button>
            </div>

            <div class="modal-body store-modal-body">
              <div class="store-modal-preview">
                <div class="store-modal-cover-wrap">
                  <img id="modalBookCover" src="" alt="Portada" class="store-modal-cover" />
                </div>
                <div class="store-modal-meta">
                  <div class="meta-tag-row">
                    <span id="modalLanguageBadge" class="format-badge format-epub">ES</span>
                    <span id="modalDownloadsBadge" class="badge-downloads">🔥 0 descargas</span>
                  </div>
                  <h3 id="modalFullTitle" class="modal-detail-title"></h3>
                  <p id="modalFullAuthor" class="modal-detail-author"></p>

                  <div class="modal-subjects-section">
                    <span class="subjects-title">Temas / Géneros:</span>
                    <div id="modalSubjectsList" class="subjects-chips-list"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer store-modal-footer">
              <button id="btnModalAddLibrary" class="btn-secondary btn-modal-action">
                📥 Añadir a Mi Biblioteca
              </button>
              <button id="btnModalReadNow" class="btn-primary btn-modal-action">
                📖 Leer Ahora
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.fetchBooks(true);
  }

  private bindEvents(): void {
    // Selector de tema
    const themeButtons = this.container.querySelectorAll("[data-theme-btn]");
    themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-theme-btn") as any;
        if (theme) {
          document.body.setAttribute("data-theme", theme);
          document.documentElement.setAttribute("data-theme", theme);
          themeButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          localDB.saveSettings({ theme });
        }
      });
    });

    // Buscador con debounce reactivo
    const searchInput = this.container.querySelector("#storeSearchInput") as HTMLInputElement;
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      if (this.searchDebounceTimer) {
        window.clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = window.setTimeout(() => {
        this.currentPage = 1;
        this.fetchBooks(true);
      }, 400);
    });

    // Chips de filtros rápidos
    const chips = this.container.querySelectorAll(".store-chip");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const chipId = chip.getAttribute("data-chip-id");
        if (chipId && chipId !== this.activeChipId) {
          this.activeChipId = chipId;
          chips.forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          this.currentPage = 1;
          this.fetchBooks(true);
        }
      });
    });

    // Botón Cargar Más
    const btnLoadMore = this.container.querySelector("#btnStoreLoadMore") as HTMLButtonElement;
    btnLoadMore?.addEventListener("click", () => {
      if (!this.isLoading && this.hasNext) {
        this.currentPage += 1;
        this.fetchBooks(false);
      }
    });

    // Modal de detalle
    const modal = this.container.querySelector("#storeBookModal") as HTMLElement;
    const modalBackdrop = this.container.querySelector(".modal-backdrop") as HTMLElement;
    const btnCloseModal = this.container.querySelector("#btnCloseStoreModal") as HTMLButtonElement;
    const btnAddLibrary = this.container.querySelector("#btnModalAddLibrary") as HTMLButtonElement;
    const btnReadNow = this.container.querySelector("#btnModalReadNow") as HTMLButtonElement;

    const closeModal = () => {
      modal?.classList.remove("visible");
      window.setTimeout(() => {
        modal?.classList.add("hidden");
        this.selectedBook = null;
      }, 220);
    };

    btnCloseModal?.addEventListener("click", closeModal);
    modalBackdrop?.addEventListener("click", closeModal);

    btnAddLibrary?.addEventListener("click", async () => {
      if (!this.selectedBook) return;
      const book = this.selectedBook;
      btnAddLibrary.disabled = true;
      btnAddLibrary.textContent = "⏳ Descargando...";
      try {
        await this.callbacks.onImportBook(book, false);
        this.importedBookIds.add(book.id);
        btnAddLibrary.textContent = "✓ En tu Biblioteca";
        this.renderBooksGrid();
      } catch (err: any) {
        btnAddLibrary.disabled = false;
        btnAddLibrary.textContent = "📥 Añadir a Mi Biblioteca";
        this.callbacks.showToast(err.message || "Error al importar el libro", "error");
      }
    });

    btnReadNow?.addEventListener("click", async () => {
      if (!this.selectedBook) return;
      const book = this.selectedBook;
      btnReadNow.disabled = true;
      btnReadNow.textContent = "⏳ Abriendo...";
      try {
        await this.callbacks.onImportBook(book, true);
        closeModal();
      } catch (err: any) {
        btnReadNow.disabled = false;
        btnReadNow.textContent = "📖 Leer Ahora";
        this.callbacks.showToast(err.message || "Error al abrir el libro", "error");
      }
    });
  }

  private async fetchBooks(reset: boolean): Promise<void> {
    // Si hay una petición anterior pendiente, cancelarla inmediatamente
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.isLoading = true;

    const grid = this.container.querySelector("#storeBooksGrid") as HTMLElement;
    const statusText = this.container.querySelector("#storeResultsCount") as HTMLElement;
    const loadMoreWrapper = this.container.querySelector("#storeLoadMoreWrapper") as HTMLElement;
    const btnLoadMore = this.container.querySelector("#btnStoreLoadMore") as HTMLButtonElement;

    if (reset) {
      grid.innerHTML = `
        <div class="store-loading-spinner">
          <div class="spinner-circle"></div>
          <p>Buscando en Project Gutenberg...</p>
        </div>
      `;
      loadMoreWrapper?.classList.add("hidden");
    } else {
      if (btnLoadMore) {
        btnLoadMore.disabled = true;
        btnLoadMore.textContent = "Cargando más libros...";
      }
    }

    const currentFilter = FILTER_CHIPS.find((c) => c.id === this.activeChipId);
    const language = currentFilter?.language || "es";
    const topic = currentFilter?.topic;

    try {
      const response: CatalogSearchResponse = await apiClient.searchCatalog(
        {
          search: this.searchQuery || undefined,
          language: language === "all" ? undefined : language,
          topic: topic || undefined,
          page: this.currentPage,
        },
        signal
      );

      this.totalCount = response.count;
      this.hasNext = response.has_next;

      if (reset) {
        this.books = response.results;
      } else {
        this.books.push(...response.results);
      }

      if (statusText) {
        const langLabel = currentFilter?.label || "";
        statusText.textContent = `Mostrando ${this.books.length} de ${this.totalCount.toLocaleString()} libros (${langLabel})`;
      }

      this.renderBooksGrid();

      if (loadMoreWrapper && btnLoadMore) {
        btnLoadMore.disabled = false;
        btnLoadMore.textContent = "⬇ Cargar más libros...";
        if (this.hasNext) {
          loadMoreWrapper.classList.remove("hidden");
        } else {
          loadMoreWrapper.classList.add("hidden");
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Petición cancelada porque el usuario seleccionó otro filtro, ignorar
        return;
      }
      console.error("Error cargando catálogo:", err);
      if (reset) {
        grid.innerHTML = `
          <div class="store-empty-state">
            <span class="store-empty-icon">⚠️</span>
            <h3>No se pudo cargar el catálogo</h3>
            <p>${err.message || "Error al conectar con el servidor"}</p>
            <button id="btnRetryStore" class="btn-primary btn-sm">Reintentar</button>
          </div>
        `;
        grid.querySelector("#btnRetryStore")?.addEventListener("click", () => {
          this.fetchBooks(true);
        });
      }
    } finally {
      this.isLoading = false;
    }
  }

  private renderBooksGrid(): void {
    const grid = this.container.querySelector("#storeBooksGrid") as HTMLElement;
    if (!grid) return;

    if (this.books.length === 0) {
      grid.innerHTML = `
        <div class="store-empty-state">
          <span class="store-empty-icon">🔍</span>
          <h3>No se encontraron libros</h3>
          <p>Prueba con otros términos de búsqueda o cambia la categoría.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = "";
    this.books.forEach((book) => {
      const card = this.createStoreBookCard(book);
      grid.appendChild(card);
    });
  }

  private createStoreBookCard(book: CatalogBookItem): HTMLElement {
    const card = document.createElement("div");
    card.className = "store-book-card";

    const authorsStr = book.authors.join(", ") || "Autor desconocido";
    const coverUrl = book.cover_url || generateBookCover(book.title, authorsStr);
    const isImported = this.importedBookIds.has(book.id);
    const mainLang = (book.languages[0] || "es").toUpperCase();
    const downloadsFormatted = this.formatDownloads(book.download_count);

    card.innerHTML = `
      <div class="store-card-cover-wrapper">
        <img src="${coverUrl}" alt="Portada de ${escapeHtml(book.title)}" class="store-card-cover" loading="lazy" />
        <span class="store-card-badge-lang">${mainLang}</span>
        ${book.download_count > 1000 ? `<span class="store-card-badge-fire">🔥 Popular</span>` : ""}
      </div>
      <div class="store-card-content">
        <h3 class="store-card-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
        <p class="store-card-author" title="${escapeHtml(authorsStr)}">${escapeHtml(authorsStr)}</p>
        <div class="store-card-footer">
          <span class="store-card-downloads">${downloadsFormatted} descargas</span>
          <button class="btn-store-action ${isImported ? "imported" : ""}">
            ${isImported ? "✓ Guardado" : "Ver libro"}
          </button>
        </div>
      </div>
    `;

    // Clic en la tarjeta abre el modal detallado
    card.addEventListener("click", () => {
      this.openBookModal(book);
    });

    return card;
  }

  private openBookModal(book: CatalogBookItem): void {
    this.selectedBook = book;
    const modal = this.container.querySelector("#storeBookModal") as HTMLElement;
    if (!modal) return;

    const modalTitle = modal.querySelector("#modalBookTitle") as HTMLElement;
    const modalAuthor = modal.querySelector("#modalBookAuthor") as HTMLElement;
    const modalCover = modal.querySelector("#modalBookCover") as HTMLImageElement;
    const modalFullTitle = modal.querySelector("#modalFullTitle") as HTMLElement;
    const modalFullAuthor = modal.querySelector("#modalFullAuthor") as HTMLElement;
    const modalLanguageBadge = modal.querySelector("#modalLanguageBadge") as HTMLElement;
    const modalDownloadsBadge = modal.querySelector("#modalDownloadsBadge") as HTMLElement;
    const modalSubjectsList = modal.querySelector("#modalSubjectsList") as HTMLElement;
    const btnAddLibrary = modal.querySelector("#btnModalAddLibrary") as HTMLButtonElement;
    const btnReadNow = modal.querySelector("#btnModalReadNow") as HTMLButtonElement;

    const authorsStr = book.authors.join(", ") || "Autor desconocido";
    const coverUrl = book.cover_url || generateBookCover(book.title, authorsStr);
    const isImported = this.importedBookIds.has(book.id);

    if (modalTitle) modalTitle.textContent = book.title;
    if (modalAuthor) modalAuthor.textContent = authorsStr;
    if (modalCover) modalCover.src = coverUrl;
    if (modalFullTitle) modalFullTitle.textContent = book.title;
    if (modalFullAuthor) modalFullAuthor.textContent = authorsStr;
    if (modalLanguageBadge) modalLanguageBadge.textContent = (book.languages[0] || "es").toUpperCase();
    if (modalDownloadsBadge) modalDownloadsBadge.textContent = `🔥 ${this.formatDownloads(book.download_count)} descargas`;

    if (modalSubjectsList) {
      if (book.subjects && book.subjects.length > 0) {
        modalSubjectsList.innerHTML = book.subjects
          .map((s) => `<span class="subject-chip">${escapeHtml(s)}</span>`)
          .join("");
      } else {
        modalSubjectsList.innerHTML = `<span class="subject-chip-empty">Literatura General</span>`;
      }
    }

    if (btnAddLibrary) {
      btnAddLibrary.disabled = isImported;
      btnAddLibrary.textContent = isImported ? "✓ Ya en tu Biblioteca" : "📥 Añadir a Mi Biblioteca";
    }

    if (btnReadNow) {
      btnReadNow.disabled = false;
      btnReadNow.textContent = "📖 Leer Ahora";
    }

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
      modal.classList.add("visible");
    });
  }

  private formatDownloads(count: number): string {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(".0", "") + "k";
    }
    return String(count);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
