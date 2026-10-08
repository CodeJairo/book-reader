import { BookDetail, Annotation } from "../types/book.ts";
import { ThemeMode, ReadingMode } from "../types/settings.ts";
import { PaginationEngine } from "./pagination.ts";
import { bindTTSUI, TextToSpeechService } from "../audio/textToSpeech.ts";
import { localDB } from "../storage/database.ts";
import { apiClient } from "../api/apiClient.ts";
import { TextHighlighter } from "./textHighlighter.ts";
import { AnnotationsSidebar } from "./annotationsSidebar.ts";

export interface BookRendererCallbacks {
  onBackToLibrary: () => void;
  onProgressUpdate: (
    bookId: string,
    currentPage: number,
    totalPages: number,
    percentage: number,
    readingTimeSeconds: number
  ) => void;
}

export class BookRenderer {
  private container: HTMLElement;
  private book: BookDetail;
  private callbacks: BookRendererCallbacks;

  private fontSize = 18;
  private currentTheme: ThemeMode = "claro";
  private readingMode: ReadingMode = "paginated";
  private readingTimeSeconds = 0;
  private timerInterval: number | null = null;
  private saveTimeout: number | null = null;

  private annotations: Annotation[] = [];
  private pagination: PaginationEngine | null = null;
  private ttsService: TextToSpeechService | null = null;
  private highlighter: TextHighlighter | null = null;
  private sidebar: AnnotationsSidebar | null = null;

  constructor(
    container: HTMLElement,
    book: BookDetail,
    callbacks: BookRendererCallbacks
  ) {
    this.container = container;
    this.book = book;
    this.callbacks = callbacks;

    if (book.progress) {
      this.readingTimeSeconds = book.progress.reading_time_seconds || 0;
    }
  }

  async render(): Promise<void> {
    const settings = await localDB.getSettings();
    this.fontSize = settings.fontSize || 18;
    this.currentTheme = settings.theme || "claro";
    this.readingMode = settings.readingMode || "paginated";
    document.body.setAttribute("data-theme", this.currentTheme);

    // Cargar anotaciones del libro
    try {
      this.annotations = await apiClient.listAnnotations(this.book.id);
    } catch {
      this.annotations = [];
    }

    this.container.innerHTML = `
      <div class="reader-view">
        <!-- Top Reader Toolbar (Mobile-first uncluttered) -->
        <header class="reader-toolbar">
          <div class="toolbar-left">
            <button id="btnBackToLibrary" class="btn-toolbar-icon" title="Volver a la Biblioteca" aria-label="Volver a la biblioteca">
              ← <span class="hide-on-mobile">Biblioteca</span>
            </button>
            <div class="reader-book-meta">
              <h2 class="reader-book-title" title="${escapeHtml(this.book.title)}">${escapeHtml(this.book.title)}</h2>
              <span class="reader-book-author">${escapeHtml(this.book.author)}</span>
            </div>
          </div>

          <div class="toolbar-right">
            <!-- Lector de voz -->
            <button id="btnToggleTTS" class="btn-toolbar-action" title="Lector de voz (Text-to-Speech)" aria-label="Lector de voz">
              🔊
            </button>

            <!-- Notas de estudio -->
            <button id="btnToggleNotes" class="btn-toolbar-action btn-notes-badge" title="Ver notas y citas" aria-label="Ver notas y citas">
              📝 <span id="notesCountBadge">${this.annotations.length}</span>
            </button>

            <!-- Ajustes de lectura (Aa) -->
            <button id="btnToggleSettings" class="btn-toolbar-action btn-settings-trigger" title="Ajustes de lectura (fuente, tema, modo)" aria-label="Ajustes de lectura">
              Aa
            </button>
          </div>
        </header>

        <!-- Sheet / Modal de Ajustes de Lectura (Mobile-First) -->
        <div id="settingsBackdrop" class="settings-backdrop hidden"></div>
        <div id="readerSettingsSheet" class="reader-settings-sheet hidden">
          <div class="settings-sheet-header">
            <h4>Ajustes de Lectura</h4>
            <button id="btnCloseSettings" class="btn-icon" aria-label="Cerrar ajustes">✕</button>
          </div>

          <div class="settings-sheet-body">
            <!-- Tamaño de Letra -->
            <div class="settings-section">
              <span class="settings-section-title">Tamaño de letra</span>
              <div class="settings-font-control">
                <button id="btnFontDown" class="btn-font-step" aria-label="Disminuir fuente">A−</button>
                <span id="fontSizeDisplay" class="font-size-text">${this.fontSize}px</span>
                <button id="btnFontUp" class="btn-font-step" aria-label="Aumentar fuente">A+</button>
              </div>
            </div>

            <!-- Temas Visuales -->
            <div class="settings-section">
              <span class="settings-section-title">Tema visual</span>
              <div class="settings-themes-grid">
                <button class="theme-card ${this.currentTheme === "claro" ? "active" : ""}" data-theme="claro">
                  <span class="theme-preview-dot theme-preview-claro"></span>
                  <span>Claro</span>
                </button>
                <button class="theme-card ${this.currentTheme === "sepia" ? "active" : ""}" data-theme="sepia">
                  <span class="theme-preview-dot theme-preview-sepia"></span>
                  <span>Sepia</span>
                </button>
                <button class="theme-card ${this.currentTheme === "oscuro" ? "active" : ""}" data-theme="oscuro">
                  <span class="theme-preview-dot theme-preview-oscuro"></span>
                  <span>Oscuro</span>
                </button>
              </div>
            </div>

            <!-- Modo de Lectura -->
            <div class="settings-section">
              <span class="settings-section-title">Modo de lectura</span>
              <div class="settings-modes-grid">
                <button id="btnModePaginated" class="mode-card ${this.readingMode === "paginated" ? "active" : ""}">
                  📄 Modo Libro
                </button>
                <button id="btnModeScroll" class="mode-card ${this.readingMode === "scroll" ? "active" : ""}">
                  📜 Scroll Continuo
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- TTS Panel (Colapsible) -->
        <div id="readerTTSPanel" class="reader-tts-panel hidden">
          <div class="tts-inline-controls">
            <div class="tts-btn-group">
              <button id="ttsPlayBtn" class="btn-primary btn-sm">▶ Reproducir</button>
              <button id="ttsPauseBtn" class="btn-secondary btn-sm">⏸ Pausar</button>
              <button id="ttsStopBtn" class="btn-secondary btn-sm">⏹ Detener</button>
            </div>
            <div class="tts-select-group">
              <label for="ttsVoiceSelect">Voz:</label>
              <select id="ttsVoiceSelect" class="tts-select"></select>
            </div>
            <div class="tts-range-group">
              <label for="ttsRateControl">Velocidad: <span id="ttsRateLabel">1x</span></label>
              <input type="range" id="ttsRateControl" min="0.5" max="2" step="0.1" value="1" />
            </div>
          </div>
        </div>

        <!-- Main Reading Container -->
        <main class="reader-main">
          <div class="page-header-indicator">
            <span id="pageIndicatorTop">Vista de lectura</span>
            <span id="readingTimeIndicator">⏱ Leído: ${this.formatTime(this.readingTimeSeconds)}</span>
          </div>

          <div id="readingArea" class="reading-area ${this.readingMode === "scroll" ? "scroll-mode" : ""}" style="font-size: ${this.fontSize}px;">
            ${this.formatContent(this.book.content, this.annotations)}
          </div>
        </main>

        <!-- Bottom Footer Navigation (Mobile-first friendly) -->
        <footer class="reader-footer ${this.readingMode === "scroll" ? "hidden" : ""}">
          <button id="btnPrevPage" class="btn-nav" aria-label="Página anterior">⬅ Anterior</button>
          <span id="pageCounter" class="page-counter">Página 1 / 1</span>
          <button id="btnNextPage" class="btn-nav" aria-label="Página siguiente">Siguiente ➡</button>
        </footer>
      </div>
    `;

    this.initControls();
    this.startReadingTimer();
  }

  private initControls(): void {
    const readingArea = this.container.querySelector("#readingArea") as HTMLElement;
    const pageCounter = this.container.querySelector("#pageCounter") as HTMLElement;
    const pageIndicatorTop = this.container.querySelector("#pageIndicatorTop") as HTMLElement;
    const prevBtn = this.container.querySelector("#btnPrevPage") as HTMLButtonElement;
    const nextBtn = this.container.querySelector("#btnNextPage") as HTMLButtonElement;

    // Inicializar PaginationEngine
    this.pagination = new PaginationEngine({
      readingArea,
      pageCounter,
      pageIndicatorTop,
      prevBtn,
      nextBtn,
      onPageChange: (current, total, percentage) => {
        this.scheduleProgressSave(current, total, percentage);
      },
    });

    // Reanudar en la página guardada
    const initialPage = this.book.progress ? this.book.progress.current_page : 0;
    this.pagination.setInitialPage(initialPage);
    this.pagination.updatePagination();

    // Inicializar AnnotationsSidebar
    this.sidebar = new AnnotationsSidebar(this.book, {
      onJumpToPage: (pageNumber) => {
        this.pagination?.goToPage(pageNumber - 1, true);
      },
      onAnnotationDeleted: (id) => {
        this.removeHighlightFromDOM(id);
        this.updateBadgeCount();
      },
      onAnnotationUpdated: (id, note) => {
        const mark = readingArea.querySelector(`[data-annotation-id="${id}"]`);
        if (mark) {
          mark.setAttribute("title", note || "Subrayado");
        }
      },
      showToast: (msg, type) => this.showToast(msg, type),
    });
    this.sidebar.setAnnotations(this.annotations);

    // Inicializar TextHighlighter
    this.highlighter = new TextHighlighter({
      bookId: this.book.id,
      readingArea,
      getCurrentPageNumber: () => (this.pagination ? this.pagination.getCurrentPage() + 1 : 1),
      onAnnotationCreated: (created) => {
        this.annotations.push(created);
        this.sidebar?.addAnnotation(created);
        this.applyHighlightToDOM(created);
        this.updateBadgeCount();
      },
      onAnnotationDeleted: (id) => {
        this.annotations = this.annotations.filter((a) => a.id !== id);
        this.sidebar?.removeAnnotation(id);
        this.removeHighlightFromDOM(id);
        this.updateBadgeCount();
      },
      onAnnotationUpdated: (id, note) => {
        this.sidebar?.updateAnnotationNote(id, note);
        const mark = readingArea.querySelector(`[data-annotation-id="${id}"]`);
        if (mark) mark.setAttribute("title", note || "Subrayado");
      },
      showToast: (msg, type) => this.showToast(msg, type),
    });
    this.highlighter.setAnnotations(this.annotations);

    // Botón abrir panel lateral de notas
    this.container.querySelector("#btnToggleNotes")?.addEventListener("click", () => {
      this.sidebar?.toggle();
    });

    // Botón volver a la biblioteca
    const backBtn = this.container.querySelector("#btnBackToLibrary") as HTMLButtonElement;
    backBtn?.addEventListener("click", () => {
      this.destroy();
      this.callbacks.onBackToLibrary();
    });

    // --- Control de Menú de Ajustes (Aa) ---
    const settingsTrigger = this.container.querySelector("#btnToggleSettings") as HTMLButtonElement;
    const settingsSheet = this.container.querySelector("#readerSettingsSheet") as HTMLElement;
    const settingsBackdrop = this.container.querySelector("#settingsBackdrop") as HTMLElement;
    const btnCloseSettings = this.container.querySelector("#btnCloseSettings") as HTMLButtonElement;

    const openSettings = () => {
      settingsBackdrop.classList.remove("hidden");
      settingsSheet.classList.remove("hidden");
      requestAnimationFrame(() => {
        settingsBackdrop.classList.add("visible");
        settingsSheet.classList.add("open");
      });
    };

    const closeSettings = () => {
      settingsBackdrop.classList.remove("visible");
      settingsSheet.classList.remove("open");
      window.setTimeout(() => {
        settingsBackdrop.classList.add("hidden");
        settingsSheet.classList.add("hidden");
      }, 240);
    };

    settingsTrigger?.addEventListener("click", () => {
      if (settingsSheet.classList.contains("open")) {
        closeSettings();
      } else {
        openSettings();
      }
    });

    btnCloseSettings?.addEventListener("click", closeSettings);
    settingsBackdrop?.addEventListener("click", closeSettings);

    // Controles de fuente
    const fontUp = this.container.querySelector("#btnFontUp") as HTMLButtonElement;
    const fontDown = this.container.querySelector("#btnFontDown") as HTMLButtonElement;
    const fontSizeDisplay = this.container.querySelector("#fontSizeDisplay") as HTMLElement;

    fontUp?.addEventListener("click", () => {
      this.fontSize = Math.min(32, this.fontSize + 1);
      readingArea.style.fontSize = `${this.fontSize}px`;
      if (fontSizeDisplay) fontSizeDisplay.textContent = `${this.fontSize}px`;
      localDB.saveSettings({ fontSize: this.fontSize });
      this.pagination?.scheduleUpdate();
    });

    fontDown?.addEventListener("click", () => {
      this.fontSize = Math.max(14, this.fontSize - 1);
      readingArea.style.fontSize = `${this.fontSize}px`;
      if (fontSizeDisplay) fontSizeDisplay.textContent = `${this.fontSize}px`;
      localDB.saveSettings({ fontSize: this.fontSize });
      this.pagination?.scheduleUpdate();
    });

    // Temas visuales
    const themeCards = this.container.querySelectorAll(".theme-card");
    themeCards.forEach((card) => {
      card.addEventListener("click", () => {
        const theme = (card.getAttribute("data-theme") as ThemeMode) || "claro";
        this.currentTheme = theme;
        document.body.setAttribute("data-theme", theme);
        themeCards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        localDB.saveSettings({ theme });
      });
    });

    // Modo Paginado / Scroll
    const btnModePaginated = this.container.querySelector("#btnModePaginated") as HTMLButtonElement;
    const btnModeScroll = this.container.querySelector("#btnModeScroll") as HTMLButtonElement;
    const readerFooter = this.container.querySelector(".reader-footer") as HTMLElement;

    btnModePaginated?.addEventListener("click", () => {
      this.readingMode = "paginated";
      readingArea.classList.remove("scroll-mode");
      readerFooter?.classList.remove("hidden");
      btnModePaginated.classList.add("active");
      btnModeScroll.classList.remove("active");
      localDB.saveSettings({ readingMode: "paginated" });
      this.pagination?.scheduleUpdate();
    });

    btnModeScroll?.addEventListener("click", () => {
      this.readingMode = "scroll";
      readingArea.classList.add("scroll-mode");
      readerFooter?.classList.add("hidden");
      btnModeScroll.classList.add("active");
      btnModePaginated.classList.remove("active");
      localDB.saveSettings({ readingMode: "scroll" });
    });

    // Scroll listener para modo scroll
    readingArea.addEventListener("scroll", () => {
      if (this.readingMode === "scroll") {
        const maxScroll = readingArea.scrollHeight - readingArea.clientHeight;
        const currentScroll = readingArea.scrollTop;
        const percentage = maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 0;
        this.scheduleProgressSave(0, 1, percentage);
      }
    });

    // TTS Panel Toggle
    const btnToggleTTS = this.container.querySelector("#btnToggleTTS") as HTMLButtonElement;
    const ttsPanel = this.container.querySelector("#readerTTSPanel") as HTMLElement;
    btnToggleTTS?.addEventListener("click", () => {
      ttsPanel?.classList.toggle("hidden");
    });

    const ttsElements = {
      playBtn: this.container.querySelector("#ttsPlayBtn") as HTMLButtonElement,
      pauseBtn: this.container.querySelector("#ttsPauseBtn") as HTMLButtonElement,
      stopBtn: this.container.querySelector("#ttsStopBtn") as HTMLButtonElement,
      voiceSelect: this.container.querySelector("#ttsVoiceSelect") as HTMLSelectElement,
      rateControl: this.container.querySelector("#ttsRateControl") as HTMLInputElement,
      rateLabel: this.container.querySelector("#ttsRateLabel") as HTMLElement,
      pitchControl: null,
      pitchLabel: null,
    };

    this.ttsService = bindTTSUI(ttsElements, () => {
      return readingArea.innerText;
    });

    this.bindKeyboardShortcuts();
  }

  private updateBadgeCount(): void {
    const badge = this.container.querySelector("#notesCountBadge");
    if (badge) {
      badge.textContent = String(this.annotations.length);
    }
  }

  private applyHighlightToDOM(ann: Annotation): void {
    const readingArea = this.container.querySelector("#readingArea");
    if (!readingArea) return;

    // Buscar coincidencia exacta en párrafos y encabezados
    const textNodes = readingArea.querySelectorAll("p, h2, h3, blockquote");
    for (const p of Array.from(textNodes)) {
      if (p.textContent && p.textContent.includes(ann.selected_text)) {
        const html = p.innerHTML;
        const escapedTarget = escapeHtml(ann.selected_text);
        if (html.includes(escapedTarget)) {
          const markHtml = `<mark class="book-highlight highlight-${ann.color}" data-annotation-id="${ann.id}" title="${ann.note ? escapeHtml(ann.note) : "Subrayado"}">${escapedTarget}</mark>`;
          p.innerHTML = html.replace(escapedTarget, markHtml);
          break;
        }
      }
    }
  }

  private removeHighlightFromDOM(id: string): void {
    const readingArea = this.container.querySelector("#readingArea");
    if (!readingArea) return;
    const mark = readingArea.querySelector(`[data-annotation-id="${id}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent?.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    }
  }

  private bindKeyboardShortcuts(): void {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowLeft" && this.readingMode === "paginated") {
        const prevBtn = this.container.querySelector("#btnPrevPage") as HTMLButtonElement;
        if (prevBtn && !prevBtn.disabled) prevBtn.click();
      } else if (e.key === "ArrowRight" && this.readingMode === "paginated") {
        const nextBtn = this.container.querySelector("#btnNextPage") as HTMLButtonElement;
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
      } else if (e.key === "Escape") {
        this.destroy();
        this.callbacks.onBackToLibrary();
      }
    };

    window.addEventListener("keydown", keyHandler);
  }

  private startReadingTimer(): void {
    this.timerInterval = window.setInterval(() => {
      this.readingTimeSeconds += 1;
      const indicator = this.container.querySelector("#readingTimeIndicator");
      if (indicator) {
        indicator.textContent = `⏱ Leído: ${this.formatTime(this.readingTimeSeconds)}`;
      }
    }, 1000);
  }

  private scheduleProgressSave(currentPage: number, totalPages: number, percentage: number): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      this.callbacks.onProgressUpdate(
        this.book.id,
        currentPage,
        totalPages,
        percentage,
        this.readingTimeSeconds
      );
    }, 500);
  }

  private formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  }

  private formatContent(raw: string, annotations: Annotation[]): string {
    const paragraphs = raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return paragraphs
      .map((p) => {
        const isHeading = p.startsWith("## ");
        const rawText = isHeading ? p.substring(3).trim() : p;
        let clean = escapeHtml(rawText).replace(/\n+/g, " ");

        // Reemplazar coincidencias de anotaciones con <mark>
        annotations.forEach((ann) => {
          const escapedTarget = escapeHtml(ann.selected_text);
          if (clean.includes(escapedTarget)) {
            const markTag = `<mark class="book-highlight highlight-${ann.color}" data-annotation-id="${ann.id}" title="${ann.note ? escapeHtml(ann.note) : "Subrayado"}">${escapedTarget}</mark>`;
            clean = clean.split(escapedTarget).join(markTag);
          }
        });

        if (isHeading) {
          return `<h2 class="book-chapter-title">${clean}</h2>`;
        }
        return `<p>${clean}</p>`;
      })
      .join("\n");
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
      window.setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  destroy(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
    }
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    if (this.ttsService) {
      this.ttsService.stop();
    }
    this.highlighter?.destroy();
    this.sidebar?.destroy();

    // Guardar progreso final
    if (this.pagination) {
      this.callbacks.onProgressUpdate(
        this.book.id,
        this.pagination.getCurrentPage(),
        this.pagination.getTotalPages(),
        ((this.pagination.getCurrentPage() + 1) / this.pagination.getTotalPages()) * 100,
        this.readingTimeSeconds
      );
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
