export interface PaginationOptions {
  readingArea: HTMLElement;
  pageCounter: HTMLElement;
  pageIndicatorTop?: HTMLElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  onPageChange?: (currentPage: number, totalPages: number, percentage: number) => void;
}

export class PaginationEngine {
  private readingArea: HTMLElement;
  private pageCounter: HTMLElement;
  private pageIndicatorTop?: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private onPageChange?: (currentPage: number, totalPages: number, percentage: number) => void;

  private currentPage = 0;
  private totalPages = 1;
  private resizeTimeout: number | null = null;

  constructor(options: PaginationOptions) {
    this.readingArea = options.readingArea;
    this.pageCounter = options.pageCounter;
    this.pageIndicatorTop = options.pageIndicatorTop;
    this.prevBtn = options.prevBtn;
    this.nextBtn = options.nextBtn;
    this.onPageChange = options.onPageChange;

    this.bindEvents();
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
      this.scheduleUpdate();
    });
  }

  scheduleUpdate(): void {
    if (this.resizeTimeout !== null) {
      window.clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = window.setTimeout(() => {
      this.updatePagination();
    }, 150);
  }

  updatePagination(): void {
    this.readingArea.classList.remove("two-column-layout");

    requestAnimationFrame(() => {
      const viewHeight = this.readingArea.clientHeight || 1;
      const contentHeight = this.readingArea.scrollHeight || 1;

      this.totalPages = Math.max(1, Math.ceil(contentHeight / viewHeight));

      if (this.totalPages === 1 && window.innerWidth > 900) {
        this.readingArea.classList.add("two-column-layout");
      }

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
      this.updateIndicators();
      return;
    }

    this.currentPage = Math.max(0, Math.min(index, this.totalPages - 1));
    const targetScrollTop = this.currentPage * this.readingArea.clientHeight;

    if (animate) {
      const animClass = direction === "backward" ? "turn-backward" : "turn-forward";
      this.readingArea.classList.remove("turn-forward", "turn-backward");
      void this.readingArea.offsetWidth; // reset animation
      this.readingArea.classList.add(animClass);

      this.readingArea.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });

      window.setTimeout(() => {
        this.readingArea.classList.remove(animClass);
      }, 400);
    } else {
      this.readingArea.scrollTop = targetScrollTop;
    }

    this.updateIndicators();

    const percentage = ((this.currentPage + 1) / this.totalPages) * 100;
    if (this.onPageChange) {
      this.onPageChange(this.currentPage, this.totalPages, percentage);
    }
  }

  private updateIndicators(): void {
    const pageNum = this.currentPage + 1;
    this.pageCounter.textContent = `Página ${pageNum} / ${this.totalPages}`;
    if (this.pageIndicatorTop) {
      this.pageIndicatorTop.textContent =
        this.totalPages > 1 ? `Página ${pageNum} de ${this.totalPages}` : "Vista de lectura";
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
