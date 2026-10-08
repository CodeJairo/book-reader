import { appState } from "./appState.ts";
import { apiClient } from "../api/apiClient.ts";
import { LibraryView } from "../library/libraryView.ts";
import { BookRenderer } from "../book/bookRenderer.ts";
import { processFile } from "../import/fileUpload.ts";
import { BookCreateInput } from "../types/book.ts";

export class AppController {
  private container: HTMLElement;
  private currentRenderer: BookRenderer | null = null;
  private libraryView: LibraryView | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private init(): void {
    appState.subscribe(async (state) => {
      if (state.currentView === "library") {
        await this.renderLibrary();
      } else if (state.currentView === "reader" && state.currentBookId) {
        await this.renderReader(state.currentBookId);
      }
    });

    // Vista inicial
    this.renderLibrary();
  }

  private async renderLibrary(): Promise<void> {
    if (this.currentRenderer) {
      this.currentRenderer.destroy();
      this.currentRenderer = null;
    }

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

  private async renderReader(bookId: string): Promise<void> {
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

  private async handleFileImport(file: File): Promise<void> {
    this.showToast(`Importando ${file.name}...`, "info");

    try {
      const extracted = await processFile(file);
      const createdBook = await apiClient.createBook(extracted);
      this.showToast(`✓ "${createdBook.title}" añadido a tu biblioteca`, "success");

      // Si estábamos en la vista de biblioteca, recargar datos
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

      // Abrir directamente en el lector
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
