export interface PaginationOptions {
  readingArea: HTMLElement;
  pageCounter: HTMLElement;
  pageIndicatorTop?: HTMLElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  columns?: 1 | 2;
  onPageChange?: (currentPage: number, totalPages: number, percentage: number) => void;
}

export class PaginationEngine {
  private readingArea: HTMLElement;
  private pageCounter: HTMLElement;
  private pageIndicatorTop?: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private onPageChange?: (currentPage: number, totalPages: number, percentage: number) => void;

  private columns: 1 | 2 = 1;
  private currentPage = 0;
  private totalPages = 1;
  private resizeTimeout: number | null = null;

  constructor(options: PaginationOptions) {
    this.readingArea = options.readingArea;
    this.pageCounter = options.pageCounter;
    this.pageIndicatorTop = options.pageIndicatorTop;
    this.prevBtn = options.prevBtn;
    this.nextBtn = options.nextBtn;
    this.columns = options.columns || 1;
    this.onPageChange = options.onPageChange;

    this.applyColumnLayout();
    this.bindEvents();
  }

  setColumns(cols: 1 | 2): void {
    if (this.columns !== cols) {
      this.columns = cols;
      this.applyColumnLayout();
      this.scheduleUpdate();
    }
  }

  getColumns(): 1 | 2 {
    return this.columns;
  }

  private applyColumnLayout(): void {
    const isWideScreen = typeof window !== "undefined" && window.innerWidth >= 768;
    if (this.columns === 2 && isWideScreen) {
      this.readingArea.classList.add("two-column-layout");
      this.readingArea.classList.remove("single-column-layout");
    } else {
      this.readingArea.classList.remove("two-column-layout");
      this.readingArea.classList.add("single-column-layout");
    }
  }

  private bindEvents(): void {
    this.prevBtn.addEventListener("click", () => {
      if (this.currentPage > 0) {
        this.goToPage(this.currentPage - 1, true, "backward");
      }
    });

    this.nextBtn.addEventListener("click", () => {
      if (this.currentPage < this.totalPages - 1) {
        this.goToPage(this.currentPage + 1, true, "forward");
      }
    });

    window.addEventListener("resize", () => {
      this.applyColumnLayout();
      this.scheduleUpdate();
    });
  }

  scheduleUpdate(): void {
    if (this.resizeTimeout !== null) {
      window.clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = window.setTimeout(() => {
      this.updatePagination();
    }, 120);
  }

  updatePagination(): void {
    this.applyColumnLayout();

    requestAnimationFrame(() => {
      const isTwoCols = this.readingArea.classList.contains("two-column-layout");

      let viewDim = 1;
      let contentDim = 1;

      if (isTwoCols) {
        // En 2 columnas (pantallas amplias), el contenido fluye en columnas horizontales (scrollWidth)
        viewDim = Math.max(1, this.readingArea.clientWidth);
        contentDim = Math.max(1, this.readingArea.scrollWidth);
      } else {
        // En 1 columna (página por página simple), el contenido fluye en el eje vertical (scrollHeight)
        viewDim = Math.max(1, this.readingArea.clientHeight);
        contentDim = Math.max(1, this.readingArea.scrollHeight);
      }

      const calculatedPages = Math.max(1, Math.ceil(contentDim / viewDim));
      this.totalPages = calculatedPages;

      if (this.currentPage > this.totalPages - 1) {
        this.currentPage = this.totalPages - 1;
      }

      this.goToPage(this.currentPage, false);
      this.updateIndicators();
    });
  }

  goToPage(index: number, animate = true, direction: "forward" | "backward" = "forward"): void {
    if (this.totalPages <= 1) {
      this.currentPage = 0;
      this.readingArea.scrollTop = 0;
      this.readingArea.scrollLeft = 0;
      this.updateIndicators();
      return;
    }

    this.currentPage = Math.max(0, Math.min(index, this.totalPages - 1));
    const isTwoCols = this.readingArea.classList.contains("two-column-layout");

    if (isTwoCols) {
      const targetScrollLeft = this.currentPage * (this.readingArea.clientWidth || 1);
      this.readingArea.scrollTop = 0;
      if (animate) {
        this.readingArea.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
      } else {
        this.readingArea.scrollLeft = targetScrollLeft;
      }
    } else {
      const targetScrollTop = this.currentPage * (this.readingArea.clientHeight || 1);
      this.readingArea.scrollLeft = 0;
      if (animate) {
        const animClass = direction === "backward" ? "turn-backward" : "turn-forward";
        this.readingArea.classList.remove("turn-forward", "turn-backward");
        void this.readingArea.offsetWidth;
        this.readingArea.classList.add(animClass);

        this.readingArea.scrollTo({ top: targetScrollTop, behavior: "smooth" });
        window.setTimeout(() => {
          this.readingArea.classList.remove(animClass);
        }, 350);
      } else {
        this.readingArea.scrollTop = targetScrollTop;
      }
    }

    this.updateIndicators();

    const percentage = ((this.currentPage + 1) / this.totalPages) * 100;
    if (this.onPageChange) {
      this.onPageChange(this.currentPage, this.totalPages, percentage);
    }
  }

  private updateIndicators(): void {
    const isTwoCols = this.readingArea.classList.contains("two-column-layout");

    if (isTwoCols) {
      const p1 = this.currentPage * 2 + 1;
      const totalVirtual = this.totalPages * 2;
      const p2 = Math.min(this.currentPage * 2 + 2, totalVirtual);
      this.pageCounter.textContent = `Páginas ${p1}-${p2} / ${totalVirtual}`;
      if (this.pageIndicatorTop) {
        this.pageIndicatorTop.textContent = `Páginas ${p1}-${p2} de ${totalVirtual}`;
      }
    } else {
      const pageNum = this.currentPage + 1;
      this.pageCounter.textContent = `Página ${pageNum} / ${this.totalPages}`;
      if (this.pageIndicatorTop) {
        this.pageIndicatorTop.textContent =
          this.totalPages > 1 ? `Página ${pageNum} de ${this.totalPages}` : "Vista de lectura";
      }
    }

    this.prevBtn.disabled = this.currentPage <= 0;
    this.nextBtn.disabled = this.currentPage >= this.totalPages - 1;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  getTotalPages(): number {
    return this.totalPages;
  }

  setInitialPage(page: number): void {
    this.currentPage = Math.max(0, page);
  }
}
