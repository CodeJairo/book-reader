import { Book } from "../types/book.ts";
import { generateBookCover } from "./coverGenerator.ts";

export interface BookCardHandlers {
  onOpen: (bookId: string) => void;
  onToggleFavorite: (bookId: string) => void;
  onToggleFinished: (bookId: string) => void;
  onDelete: (bookId: string) => void;
}

export function createBookCard(book: Book, handlers: BookCardHandlers): HTMLElement {
  const card = document.createElement("div");
  card.className = "book-card";
  card.setAttribute("data-book-id", book.id);

  const coverSrc = book.cover_url || generateBookCover(book.title, book.author);
  const percentage = book.progress ? Math.round(book.progress.percentage) : 0;
  const currentPage = book.progress ? book.progress.current_page + 1 : 1;
  const totalPages = book.progress ? book.progress.total_pages : book.total_pages_estimated;

  const formatLabels: Record<string, string> = {
    pdf: "PDF",
    docx: "DOCX",
    txt: "TXT",
    manual: "APUNTE",
    epub: "EPUB",
  };
  const formatBadge = formatLabels[book.format] || book.format.toUpperCase();

  card.innerHTML = `
    <div class="book-card-cover-wrapper">
      <img src="${coverSrc}" alt="Portada de ${escapeHtml(book.title)}" class="book-card-cover" loading="lazy" />
      <span class="book-badge format-badge format-${book.format}">${formatBadge}</span>
      ${book.is_finished ? `<span class="book-badge finished-badge">✓ Leído</span>` : ""}
      <button class="book-fav-btn ${book.is_favorite ? "is-fav" : ""}" title="${book.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}" aria-label="Favorito">
        ${book.is_favorite ? "★" : "☆"}
      </button>
    </div>

    <div class="book-card-info">
      <h3 class="book-card-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
      <p class="book-card-author">${escapeHtml(book.author || "Desconocido")}</p>
      
      <div class="book-card-progress">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-labels">
          <span>Pág. ${currentPage}/${totalPages}</span>
          <span>${percentage}%</span>
        </div>
      </div>

      <div class="book-card-actions">
        <button class="btn-card-read btn-primary">Leer</button>
        <button class="btn-card-action btn-del" title="Eliminar libro" aria-label="Eliminar">🗑️</button>
      </div>
    </div>
  `;

  // Event Listeners
  const coverWrapper = card.querySelector(".book-card-cover-wrapper") as HTMLElement;
  const readBtn = card.querySelector(".btn-card-read") as HTMLButtonElement;
  const favBtn = card.querySelector(".book-fav-btn") as HTMLButtonElement;
  const delBtn = card.querySelector(".btn-del") as HTMLButtonElement;

  const openBook = () => handlers.onOpen(book.id);
  coverWrapper.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".book-fav-btn")) return;
    openBook();
  });
  readBtn.addEventListener("click", openBook);

  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onToggleFavorite(book.id);
  });

  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm(`¿Seguro que deseas eliminar "${book.title}" de tu biblioteca?`)) {
      handlers.onDelete(book.id);
    }
  });

  return card;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
