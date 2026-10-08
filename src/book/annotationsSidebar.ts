import { BookDetail, Annotation } from "../types/book.ts";
import { apiClient } from "../api/apiClient.ts";
import { exportAnnotationsToMarkdown } from "../study/markdownExporter.ts";

export interface AnnotationsSidebarCallbacks {
  onJumpToPage: (pageNumber: number) => void;
  onAnnotationDeleted: (id: string) => void;
  onAnnotationUpdated: (id: string, note?: string | null) => void;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export class AnnotationsSidebar {
  private book: BookDetail;
  private callbacks: AnnotationsSidebarCallbacks;
  private annotations: Annotation[] = [];
  private activeFilterColor: string | null = null;
  private searchQuery = "";
  private isOpen = false;

  private drawerElement: HTMLElement | null = null;
  private backdropElement: HTMLElement | null = null;

  constructor(
    book: BookDetail,
    callbacks: AnnotationsSidebarCallbacks
  ) {
    this.book = book;
    this.callbacks = callbacks;
    this.initDrawer();
  }

  setAnnotations(list: Annotation[]): void {
    this.annotations = list;
    this.renderNotesList();
    this.updateBadge();
  }

  addAnnotation(ann: Annotation): void {
    this.annotations.unshift(ann);
    this.renderNotesList();
    this.updateBadge();
  }

  removeAnnotation(id: string): void {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this.renderNotesList();
    this.updateBadge();
  }

  updateAnnotationNote(id: string, note?: string | null): void {
    const target = this.annotations.find((a) => a.id !== id);
    if (target) {
      target.note = note || null;
      this.renderNotesList();
    }
  }

  private initDrawer(): void {
    // Backdrop para mobile y desktop
    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop hidden";
    backdrop.addEventListener("click", () => this.close());
    document.body.appendChild(backdrop);
    this.backdropElement = backdrop;

    // Drawer container
    const drawer = document.createElement("aside");
    drawer.className = "study-sidebar mobile-first-drawer hidden";
    drawer.setAttribute("aria-label", "Panel lateral de notas y subrayados");

    drawer.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title-wrapper">
          <span class="sidebar-icon">📝</span>
          <h3>Notas de Estudio</h3>
          <span id="sidebarCountBadge" class="sidebar-count-badge">0</span>
        </div>
        <button id="btnCloseSidebar" class="btn-icon" aria-label="Cerrar panel">✕</button>
      </div>

      <div class="sidebar-tools">
        <div class="sidebar-search-box">
          <span>🔍</span>
          <input type="text" id="sidebarSearchInput" placeholder="Buscar en notas o citas..." />
        </div>

        <div class="sidebar-filter-pills">
          <button class="color-filter-btn active" data-color="all">Todos</button>
          <button class="color-filter-btn pill-yellow" data-color="yellow" title="Amarillo">🟡</button>
          <button class="color-filter-btn pill-green" data-color="green" title="Verde">🟢</button>
          <button class="color-filter-btn pill-blue" data-color="blue" title="Azul">🔵</button>
          <button class="color-filter-btn pill-pink" data-color="pink" title="Rosa">🌸</button>
        </div>
      </div>

      <div id="sidebarNotesList" class="sidebar-notes-list">
        <!-- Renderizado dinámicamente -->
      </div>

      <div class="sidebar-footer">
        <button id="btnExportMarkdown" class="btn-primary btn-export" title="Exportar todas las notas en Markdown">
          📥 Exportar a Markdown (.md)
        </button>
      </div>
    `;

    document.body.appendChild(drawer);
    this.drawerElement = drawer;

    // Eventos
    drawer.querySelector("#btnCloseSidebar")?.addEventListener("click", () => this.close());

    const searchInput = drawer.querySelector("#sidebarSearchInput") as HTMLInputElement;
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderNotesList();
    });

    const filterBtns = drawer.querySelectorAll(".color-filter-btn");
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const color = btn.getAttribute("data-color");
        this.activeFilterColor = color === "all" ? null : color;
        this.renderNotesList();
      });
    });

    drawer.querySelector("#btnExportMarkdown")?.addEventListener("click", () => {
      if (this.annotations.length === 0) {
        this.callbacks.showToast("No tienes notas para exportar aún", "info");
        return;
      }
      exportAnnotationsToMarkdown(this.book, this.annotations);
      this.callbacks.showToast("✓ Archivo Markdown descargado", "success");
    });
  }

  private renderNotesList(): void {
    if (!this.drawerElement) return;
    const listEl = this.drawerElement.querySelector("#sidebarNotesList") as HTMLElement;
    if (!listEl) return;

    let filtered = [...this.annotations];

    if (this.activeFilterColor) {
      filtered = filtered.filter((a) => a.color === this.activeFilterColor);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(
        (a) =>
          a.selected_text.toLowerCase().includes(this.searchQuery) ||
          (a.note && a.note.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="sidebar-empty">
          <span class="empty-book-icon">📖</span>
          <p>No hay notas ni subrayados coincidentes.</p>
          <small>Selecciona texto en el libro para añadir citas o apuntes.</small>
        </div>
      `;
      return;
    }

    listEl.innerHTML = "";
    filtered.forEach((ann) => {
      const card = document.createElement("div");
      card.className = `sidebar-note-card border-color-${ann.color}`;
      card.setAttribute("data-id", ann.id);

      const dateStr = new Date(ann.created_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      card.innerHTML = `
        <div class="note-card-header">
          <button class="btn-jump-page" title="Ir a esta página">
            📍 Pág. ${ann.page_number}
          </button>
          <span class="note-card-date">${dateStr}</span>
          <button class="btn-delete-note btn-icon" title="Eliminar nota" aria-label="Eliminar">🗑️</button>
        </div>

        <blockquote class="note-card-quote">
          "${escapeHtml(ann.selected_text)}"
        </blockquote>

        ${
          ann.note
            ? `<div class="note-card-comment">
                <span class="pen-icon">✍️</span>
                <p>${escapeHtml(ann.note)}</p>
               </div>`
            : `<button class="btn-add-note-inline">+ Añadir apunte</button>`
        }
      `;

      // Clic en saltar a página
      card.querySelector(".btn-jump-page")?.addEventListener("click", () => {
        this.callbacks.onJumpToPage(ann.page_number);
        // En mobile cerramos el sidebar automáticamente para no tapar la lectura
        if (window.innerWidth < 768) {
          this.close();
        }
      });

      // Eliminar nota
      card.querySelector(".btn-delete-note")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm("¿Seguro que deseas eliminar este subrayado?")) {
          await apiClient.deleteAnnotation(ann.id);
          this.removeAnnotation(ann.id);
          this.callbacks.onAnnotationDeleted(ann.id);
          this.callbacks.showToast("Subrayado eliminado", "info");
        }
      });

      // Añadir apunte inline si no tiene
      card.querySelector(".btn-add-note-inline")?.addEventListener("click", () => {
        const promptNote = prompt("Escribe tu nota o apunte personal:");
        if (promptNote !== null && promptNote.trim()) {
          apiClient.updateAnnotation(ann.id, promptNote.trim()).then(() => {
            ann.note = promptNote.trim();
            this.renderNotesList();
            this.callbacks.onAnnotationUpdated(ann.id, promptNote.trim());
            this.callbacks.showToast("Nota añadida", "success");
          });
        }
      });

      listEl.appendChild(card);
    });
  }

  private updateBadge(): void {
    if (!this.drawerElement) return;
    const badge = this.drawerElement.querySelector("#sidebarCountBadge");
    if (badge) {
      badge.textContent = String(this.annotations.length);
    }
  }

  open(): void {
    this.isOpen = true;
    this.backdropElement?.classList.remove("hidden");
    this.drawerElement?.classList.remove("hidden");
    // Activar clase para animación CSS
    requestAnimationFrame(() => {
      this.backdropElement?.classList.add("visible");
      this.drawerElement?.classList.add("open");
    });
    this.renderNotesList();
    this.updateBadge();
  }

  close(): void {
    this.isOpen = false;
    this.backdropElement?.classList.remove("visible");
    this.drawerElement?.classList.remove("open");
    window.setTimeout(() => {
      this.backdropElement?.classList.add("hidden");
      this.drawerElement?.classList.add("hidden");
    }, 280);
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy(): void {
    this.backdropElement?.remove();
    this.drawerElement?.remove();
    this.backdropElement = null;
    this.drawerElement = null;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
