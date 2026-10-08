import { Book, BookCreateInput } from "../types/book.ts";
import { apiClient } from "../api/apiClient.ts";
import { createBookCard } from "./bookCard.ts";
import { generateBookCover } from "./coverGenerator.ts";

export interface LibraryViewCallbacks {
  onOpenBook: (bookId: string) => void;
  onImportFile: (file: File) => Promise<void>;
  onCreateManual: (input: BookCreateInput) => Promise<void>;
}

export class LibraryView {
  private container: HTMLElement;
  private callbacks: LibraryViewCallbacks;
  private books: Book[] = [];
  private activeFilter: "all" | "in_progress" | "finished" | "favorites" = "all";
  private searchQuery = "";
  private latestBook: Book | null = null;

  constructor(container: HTMLElement, callbacks: LibraryViewCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  async render(): Promise<void> {
    this.container.innerHTML = `
      <div class="library-page">
        <!-- Top Navigation -->
        <header class="library-header">
          <div class="header-branding">
            <span class="app-icon">📚</span>
            <div>
              <h1>Book Reader</h1>
              <p class="header-subtitle">Tu biblioteca personal y espacio de estudio</p>
            </div>
          </div>

          <div class="header-actions">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="libSearchInput" placeholder="Buscar por título o autor..." value="${this.searchQuery}" />
            </div>

            <button id="btnOpenManualModal" class="btn-secondary" title="Crear nota o pegar texto">
              ✍️ Nuevo Apunte
            </button>

            <label for="libFileInput" class="btn-primary file-import-btn" title="Cargar PDF, DOCX o TXT">
              📁 Importar Libro
              <input type="file" id="libFileInput" accept=".pdf,.docx,.txt" style="display: none;" />
            </label>
          </div>
        </header>

        <!-- Drop Zone Banner (Drag & Drop) -->
        <div id="dropZone" class="drop-zone hidden">
          <div class="drop-zone-content">
            <span class="drop-icon">📥</span>
            <h3>Suelta tu libro aquí para importarlo</h3>
            <p>Soporta archivos PDF, DOCX y TXT</p>
          </div>
        </div>

        <!-- Section: Continuar Leyendo (Hero) -->
        <section id="continueReadingSection" class="continue-reading-section">
          <!-- Inyectado dinámicamente -->
        </section>

        <!-- Section: Catálogo de Libros -->
        <section class="catalog-section">
          <div class="catalog-header">
            <div class="catalog-tabs">
              <button class="tab-btn ${this.activeFilter === "all" ? "active" : ""}" data-filter="all">
                Todos (<span id="countAll">0</span>)
              </button>
              <button class="tab-btn ${this.activeFilter === "in_progress" ? "active" : ""}" data-filter="in_progress">
                En progreso (<span id="countInProgress">0</span>)
              </button>
              <button class="tab-btn ${this.activeFilter === "favorites" ? "active" : ""}" data-filter="favorites">
                Favoritos (<span id="countFavs">0</span>)
              </button>
              <button class="tab-btn ${this.activeFilter === "finished" ? "active" : ""}" data-filter="finished">
                Terminados (<span id="countFinished">0</span>)
              </button>
            </div>
          </div>

          <div id="booksGrid" class="books-grid">
            <div class="books-loading">Cargando tu biblioteca...</div>
          </div>
        </section>

        <!-- Modal: Pegar texto / Nuevo Apunte -->
        <div id="manualTextModal" class="modal-overlay hidden">
          <div class="modal-card">
            <div class="modal-header">
              <h3>✍️ Nuevo Documento o Apunte de Estudio</h3>
              <button id="btnCloseModal" class="btn-icon" aria-label="Cerrar modal">✕</button>
            </div>
            <div class="modal-body">
              <label for="modalTitle">Título:</label>
              <input type="text" id="modalTitle" placeholder="Ej: Resumen de Arquitectura de Software..." />

              <label for="modalAuthor">Autor / Fuente (opcional):</label>
              <input type="text" id="modalAuthor" placeholder="Ej: Mis Notas, Profesor García, Web..." />

              <label for="modalContent">Contenido / Texto:</label>
              <textarea id="modalContent" rows="10" placeholder="Pega o escribe aquí tu contenido largo..."></textarea>
            </div>
            <div class="modal-footer">
              <button id="btnCancelManual" class="btn-secondary">Cancelar</button>
              <button id="btnSaveManual" class="btn-primary">Guardar en Biblioteca</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadData();
  }

  private bindEvents(): void {
    // Búsqueda
    const searchInput = this.container.querySelector("#libSearchInput") as HTMLInputElement;
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.renderBooksGrid();
    });

    // Filtros
    const tabs = this.container.querySelectorAll(".tab-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeFilter = (tab.getAttribute("data-filter") as any) || "all";
        this.renderBooksGrid();
      });
    });

    // File Input Import
    const fileInput = this.container.querySelector("#libFileInput") as HTMLInputElement;
    fileInput?.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.callbacks.onImportFile(file);
        fileInput.value = "";
      }
    });

    // Drag & Drop
    const dropZone = this.container.querySelector("#dropZone") as HTMLElement;
    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dropZone?.classList.remove("hidden");
    });
    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    dropZone?.addEventListener("dragleave", (e) => {
      if (e.relatedTarget === null) {
        dropZone.classList.add("hidden");
      }
    });
    dropZone?.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropZone.classList.add("hidden");
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        await this.callbacks.onImportFile(file);
      }
    });

    // Modal Manual
    const modal = this.container.querySelector("#manualTextModal") as HTMLElement;
    const btnOpenModal = this.container.querySelector("#btnOpenManualModal") as HTMLButtonElement;
    const btnCloseModal = this.container.querySelector("#btnCloseModal") as HTMLButtonElement;
    const btnCancelManual = this.container.querySelector("#btnCancelManual") as HTMLButtonElement;
    const btnSaveManual = this.container.querySelector("#btnSaveManual") as HTMLButtonElement;

    const openModal = () => modal?.classList.remove("hidden");
    const closeModal = () => modal?.classList.add("hidden");

    btnOpenModal?.addEventListener("click", openModal);
    btnCloseModal?.addEventListener("click", closeModal);
    btnCancelManual?.addEventListener("click", closeModal);

    btnSaveManual?.addEventListener("click", async () => {
      const titleInput = this.container.querySelector("#modalTitle") as HTMLInputElement;
      const authorInput = this.container.querySelector("#modalAuthor") as HTMLInputElement;
      const contentInput = this.container.querySelector("#modalContent") as HTMLTextAreaElement;

      const title = titleInput.value.trim();
      const content = contentInput.value.trim();

      if (!title || !content) {
        alert("Por favor ingresa un título y el contenido del documento.");
        return;
      }

      await this.callbacks.onCreateManual({
        title,
        author: authorInput.value.trim() || "Mis Notas",
        content,
        format: "manual",
      });

      titleInput.value = "";
      authorInput.value = "";
      contentInput.value = "";
      closeModal();
    });
  }

  async loadData(): Promise<void> {
    try {
      this.books = await apiClient.listBooks();
      this.latestBook = await apiClient.getLatestReading();
      this.updateCounts();
      this.renderContinueReading();
      this.renderBooksGrid();
    } catch (err) {
      console.error("Error cargando biblioteca:", err);
    }
  }

  private updateCounts(): void {
    const all = this.books.length;
    const inProgress = this.books.filter(
      (b) => b.progress && b.progress.percentage > 0 && b.progress.percentage < 100
    ).length;
    const favs = this.books.filter((b) => b.is_favorite).length;
    const finished = this.books.filter((b) => b.is_finished).length;

    const elAll = this.container.querySelector("#countAll");
    const elProg = this.container.querySelector("#countInProgress");
    const elFavs = this.container.querySelector("#countFavs");
    const elFin = this.container.querySelector("#countFinished");

    if (elAll) elAll.textContent = String(all);
    if (elProg) elProg.textContent = String(inProgress);
    if (elFavs) elFavs.textContent = String(favs);
    if (elFin) elFin.textContent = String(finished);
  }

  private renderContinueReading(): void {
    const section = this.container.querySelector("#continueReadingSection") as HTMLElement;
    if (!section) return;

    if (!this.latestBook) {
      section.innerHTML = "";
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    const book = this.latestBook;
    const coverSrc = book.cover_url || generateBookCover(book.title, book.author);
    const percentage = book.progress ? Math.round(book.progress.percentage) : 0;
    const currentPage = book.progress ? book.progress.current_page + 1 : 1;
    const totalPages = book.progress ? book.progress.total_pages : book.total_pages_estimated;

    section.innerHTML = `
      <div class="continue-card">
        <div class="continue-cover-wrapper">
          <img src="${coverSrc}" alt="Portada" class="continue-cover" />
        </div>
        <div class="continue-info">
          <span class="continue-badge">⚡ Continuar Leyendo</span>
          <h2 class="continue-title">${escapeHtml(book.title)}</h2>
          <p class="continue-author">Por ${escapeHtml(book.author || "Desconocido")}</p>
          <div class="continue-progress-bar">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-labels">
              <span>Página ${currentPage} de ${totalPages}</span>
              <span>${percentage}% completado</span>
            </div>
          </div>
          <button id="btnResumeLatest" class="btn-primary btn-large">
            ▶ Continuar Lectura
          </button>
        </div>
      </div>
    `;

    section.querySelector("#btnResumeLatest")?.addEventListener("click", () => {
      this.callbacks.onOpenBook(book.id);
    });
  }

  private renderBooksGrid(): void {
    const grid = this.container.querySelector("#booksGrid") as HTMLElement;
    if (!grid) return;

    // Filtrado
    let filtered = [...this.books];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q)
      );
    }

    if (this.activeFilter === "in_progress") {
      filtered = filtered.filter(
        (b) => b.progress && b.progress.percentage > 0 && b.progress.percentage < 100
      );
    } else if (this.activeFilter === "favorites") {
      filtered = filtered.filter((b) => b.is_favorite);
    } else if (this.activeFilter === "finished") {
      filtered = filtered.filter((b) => b.is_finished);
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📖</span>
          <h3>No se encontraron libros</h3>
          <p>Importa un archivo PDF, DOCX o TXT o crea un nuevo apunte para comenzar tu lectura.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = "";
    filtered.forEach((book) => {
      const card = createBookCard(book, {
        onOpen: (id) => this.callbacks.onOpenBook(id),
        onToggleFavorite: async (id) => {
          await apiClient.toggleFavorite(id);
          await this.loadData();
        },
        onToggleFinished: async (id) => {
          await apiClient.toggleFinished(id);
          await this.loadData();
        },
        onDelete: async (id) => {
          await apiClient.deleteBook(id);
          await this.loadData();
        },
      });
      grid.appendChild(card);
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
