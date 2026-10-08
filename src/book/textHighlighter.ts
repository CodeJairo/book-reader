import { Annotation } from "../types/book.ts";
import { apiClient } from "../api/apiClient.ts";

export interface TextHighlighterOptions {
  bookId: string;
  readingArea: HTMLElement;
  getCurrentPageNumber: () => number;
  onAnnotationCreated: (ann: Annotation) => void;
  onAnnotationDeleted: (id: string) => void;
  onAnnotationUpdated: (id: string, note?: string | null) => void;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export class TextHighlighter {
  private bookId: string;
  private readingArea: HTMLElement;
  private getCurrentPageNumber: () => number;
  private onAnnotationCreated: (ann: Annotation) => void;
  private onAnnotationDeleted: (id: string) => void;
  private onAnnotationUpdated: (id: string, note?: string | null) => void;
  private showToast: (msg: string, type?: "info" | "success" | "error") => void;

  private selectionPopover: HTMLElement | null = null;
  private detailPopover: HTMLElement | null = null;
  private currentSelectionText = "";
  private annotationsMap = new Map<string, Annotation>();

  constructor(options: TextHighlighterOptions) {
    this.bookId = options.bookId;
    this.readingArea = options.readingArea;
    this.getCurrentPageNumber = options.getCurrentPageNumber;
    this.onAnnotationCreated = options.onAnnotationCreated;
    this.onAnnotationDeleted = options.onAnnotationDeleted;
    this.onAnnotationUpdated = options.onAnnotationUpdated;
    this.showToast = options.showToast;

    this.init();
  }

  setAnnotations(annotations: Annotation[]): void {
    this.annotationsMap.clear();
    annotations.forEach((ann) => this.annotationsMap.set(ann.id, ann));
  }

  private init(): void {
    // Escuchar selección con ratón y pantalla táctil
    this.readingArea.addEventListener("mouseup", () => this.handleSelection());
    this.readingArea.addEventListener("touchend", () => {
      // Pequeño retardo en táctil para que el sistema complete el rango de selección
      window.setTimeout(() => this.handleSelection(), 100);
    });

    // Clic sobre anotación existente
    this.readingArea.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest(".book-highlight") as HTMLElement;
      if (target) {
        e.stopPropagation();
        const id = target.getAttribute("data-annotation-id");
        if (id) this.openDetailPopover(target, id);
      }
    });

    // Ocultar popovers al hacer clic fuera
    document.addEventListener("mousedown", (e) => {
      const target = e.target as HTMLElement;
      if (
        this.selectionPopover &&
        !this.selectionPopover.contains(target) &&
        !this.readingArea.contains(target)
      ) {
        this.hideSelectionPopover();
      }
      if (
        this.detailPopover &&
        !this.detailPopover.contains(target) &&
        !target.closest(".book-highlight")
      ) {
        this.hideDetailPopover();
      }
    });
  }

  private handleSelection(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      this.hideSelectionPopover();
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      this.hideSelectionPopover();
      return;
    }

    // Verificar que el rango está dentro del área de lectura
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!this.readingArea.contains(range.commonAncestorContainer)) {
      this.hideSelectionPopover();
      return;
    }

    this.currentSelectionText = text;
    this.showSelectionPopover(range);
  }

  private showSelectionPopover(range: Range): void {
    this.hideDetailPopover();
    if (!this.selectionPopover) {
      this.createSelectionPopover();
    }

    const rect = range.getBoundingClientRect();
    const popover = this.selectionPopover!;
    popover.classList.remove("hidden");

    // Reiniciar estado interno del popover
    const noteInput = popover.querySelector(".popover-note-input") as HTMLTextAreaElement;
    const noteArea = popover.querySelector(".popover-note-area") as HTMLElement;
    if (noteInput) noteInput.value = "";
    if (noteArea) noteArea.classList.add("hidden");

    // Posicionamiento móvil-first clamped dentro del viewport
    const popoverWidth = Math.min(window.innerWidth - 24, 320);
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

    let top = rect.top - 58;
    if (top < 10) {
      // Si se sale arriba, colocarlo debajo de la selección
      top = rect.bottom + 10;
    }

    popover.style.width = `${popoverWidth}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  private createSelectionPopover(): void {
    const el = document.createElement("div");
    el.className = "highlight-popover mobile-friendly-popover";
    el.innerHTML = `
      <div class="popover-colors">
        <button class="color-btn color-yellow" data-color="yellow" title="Amarillo" aria-label="Subrayar amarillo"></button>
        <button class="color-btn color-green" data-color="green" title="Verde" aria-label="Subrayar verde"></button>
        <button class="color-btn color-blue" data-color="blue" title="Azul" aria-label="Subrayar azul"></button>
        <button class="color-btn color-pink" data-color="pink" title="Rosa" aria-label="Subrayar rosa"></button>
        <div class="popover-divider"></div>
        <button class="btn-popover-action btn-add-note" title="Añadir nota">✍️</button>
        <button class="btn-popover-action btn-copy-quote" title="Copiar cita">📋</button>
        <button class="btn-popover-action btn-close-popover" title="Cerrar">✕</button>
      </div>

      <div class="popover-note-area hidden">
        <textarea class="popover-note-input" placeholder="Escribe tu reflexión o nota..." rows="2"></textarea>
        <div class="popover-note-actions">
          <button class="btn-save-note btn-primary btn-sm">Guardar con nota</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.selectionPopover = el;

    // Colores
    el.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const color = btn.getAttribute("data-color") || "yellow";
        const noteArea = el.querySelector(".popover-note-area") as HTMLElement;
        const noteInput = el.querySelector(".popover-note-input") as HTMLTextAreaElement;
        const note = !noteArea.classList.contains("hidden") ? noteInput.value.trim() : "";
        this.saveHighlight(color, note);
      });
    });

    // Desplegar campo de nota
    el.querySelector(".btn-add-note")?.addEventListener("click", () => {
      const noteArea = el.querySelector(".popover-note-area") as HTMLElement;
      noteArea.classList.toggle("hidden");
      if (!noteArea.classList.contains("hidden")) {
        const input = el.querySelector(".popover-note-input") as HTMLTextAreaElement;
        input.focus();
      }
    });

    // Guardar con nota explícito
    el.querySelector(".btn-save-note")?.addEventListener("click", () => {
      const noteInput = el.querySelector(".popover-note-input") as HTMLTextAreaElement;
      this.saveHighlight("yellow", noteInput.value.trim());
    });

    // Copiar cita
    el.querySelector(".btn-copy-quote")?.addEventListener("click", () => {
      this.copyCurrentQuote();
    });

    // Cerrar
    el.querySelector(".btn-close-popover")?.addEventListener("click", () => {
      this.hideSelectionPopover();
    });
  }

  private async saveHighlight(color: string, note?: string): Promise<void> {
    if (!this.currentSelectionText) return;

    const pageNumber = this.getCurrentPageNumber();
    const textToSave = this.currentSelectionText;
    this.hideSelectionPopover();

    try {
      const created = await apiClient.createAnnotation(
        this.bookId,
        pageNumber,
        textToSave,
        color,
        note
      );

      this.annotationsMap.set(created.id, created);
      this.onAnnotationCreated(created);
      this.showToast(note ? "✓ Nota guardada" : "✓ Subrayado guardado", "success");

      // Limpiar selección visual nativa
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error("Error guardando anotación:", err);
      this.showToast("Error al guardar anotación", "error");
    }
  }

  private copyCurrentQuote(): void {
    if (!this.currentSelectionText) return;
    const pageNum = this.getCurrentPageNumber();
    const quote = `"${this.currentSelectionText}" (Página ${pageNum})`;

    navigator.clipboard.writeText(quote).then(() => {
      this.showToast("Cita copiada al portapapeles", "info");
      this.hideSelectionPopover();
    });
  }

  private openDetailPopover(element: HTMLElement, id: string): void {
    this.hideSelectionPopover();
    const annotation = this.annotationsMap.get(id);
    if (!annotation) return;

    if (!this.detailPopover) {
      this.createDetailPopover();
    }

    const popover = this.detailPopover!;
    popover.setAttribute("data-active-id", id);
    popover.classList.remove("hidden");

    const textEl = popover.querySelector(".detail-quote-text") as HTMLElement;
    const noteInput = popover.querySelector(".detail-note-input") as HTMLTextAreaElement;
    const pageEl = popover.querySelector(".detail-page-tag") as HTMLElement;

    if (textEl) textEl.textContent = `"${annotation.selected_text}"`;
    if (noteInput) noteInput.value = annotation.note || "";
    if (pageEl) pageEl.textContent = `Página ${annotation.page_number}`;

    // Posicionamiento móvil-first
    const rect = element.getBoundingClientRect();
    const popoverWidth = Math.min(window.innerWidth - 24, 340);
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

    let top = rect.bottom + 8;
    if (top + 180 > window.innerHeight) {
      top = rect.top - 180;
    }

    popover.style.width = `${popoverWidth}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  private createDetailPopover(): void {
    const el = document.createElement("div");
    el.className = "annotation-detail-popover mobile-friendly-popover";
    el.innerHTML = `
      <div class="detail-popover-header">
        <span class="detail-page-tag">Página</span>
        <button class="btn-detail-close btn-icon" aria-label="Cerrar">✕</button>
      </div>
      <div class="detail-quote-text"></div>
      <div class="detail-note-wrapper">
        <label>Nota personal:</label>
        <textarea class="detail-note-input" placeholder="Escribe un apunte para este fragmento..."></textarea>
      </div>
      <div class="detail-popover-footer">
        <button class="btn-detail-delete btn-del btn-sm">🗑️ Eliminar</button>
        <button class="btn-detail-save btn-primary btn-sm">Guardar nota</button>
      </div>
    `;

    document.body.appendChild(el);
    this.detailPopover = el;

    el.querySelector(".btn-detail-close")?.addEventListener("click", () => {
      this.hideDetailPopover();
    });

    el.querySelector(".btn-detail-delete")?.addEventListener("click", async () => {
      const id = el.getAttribute("data-active-id");
      if (id) {
        await apiClient.deleteAnnotation(id);
        this.annotationsMap.delete(id);
        this.onAnnotationDeleted(id);
        this.hideDetailPopover();
        this.showToast("Subrayado eliminado", "info");
      }
    });

    el.querySelector(".btn-detail-save")?.addEventListener("click", async () => {
      const id = el.getAttribute("data-active-id");
      const noteInput = el.querySelector(".detail-note-input") as HTMLTextAreaElement;
      if (id) {
        const note = noteInput.value.trim();
        await apiClient.updateAnnotation(id, note);
        const ann = this.annotationsMap.get(id);
        if (ann) ann.note = note;
        this.onAnnotationUpdated(id, note);
        this.hideDetailPopover();
        this.showToast("Nota actualizada", "success");
      }
    });
  }

  hideSelectionPopover(): void {
    if (this.selectionPopover) {
      this.selectionPopover.classList.add("hidden");
    }
  }

  hideDetailPopover(): void {
    if (this.detailPopover) {
      this.detailPopover.classList.add("hidden");
    }
  }

  destroy(): void {
    this.hideSelectionPopover();
    this.hideDetailPopover();
    this.selectionPopover?.remove();
    this.detailPopover?.remove();
    this.selectionPopover = null;
    this.detailPopover = null;
  }
}
