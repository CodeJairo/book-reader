import { Book, Annotation } from "../types/book.ts";

export function exportAnnotationsToMarkdown(book: Book, annotations: Annotation[]): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isoDate = now.toISOString().split("T")[0];

  const colorLabels: Record<string, string> = {
    yellow: "🟡 Amarillo",
    green: "🟢 Verde",
    blue: "🔵 Azul",
    pink: "🌸 Rosa",
  };

  let md = `---
libro: "${escapeYaml(book.title)}"
autor: "${escapeYaml(book.author || "Desconocido")}"
formato: "${book.format}"
fecha_exportacion: "${isoDate}"
total_notas: ${annotations.length}
---

# 📚 Notas de Estudio: ${book.title}

* **Autor:** ${book.author || "Desconocido"}
* **Fecha:** ${dateStr}
* **Total de citas y notas:** ${annotations.length}

---

`;

  if (annotations.length === 0) {
    md += `*No hay notas registradas para este libro.*\n`;
  } else {
    // Ordenar por página y luego por fecha
    const sorted = [...annotations].sort(
      (a, b) => a.page_number - b.page_number || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sorted.forEach((ann, idx) => {
      const colorLabel = colorLabels[ann.color] || ann.color;
      const createdFormatted = new Date(ann.created_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      md += `### ${idx + 1}. Página ${ann.page_number} (${colorLabel})\n\n`;
      md += `> "${ann.selected_text.trim()}"\n\n`;

      if (ann.note && ann.note.trim()) {
        md += `✍️ **Nota personal:**\n`;
        md += `${ann.note.trim()}\n\n`;
      }

      md += `*Fecha: ${createdFormatted}*\n\n`;
      md += `---\n\n`;
    });
  }

  // Descargar archivo .md
  const safeTitle = book.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const filename = `notas_${safeTitle || "libro"}.md`;
  downloadBlob(md, filename, "text/markdown;charset=utf-8;");
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"');
}
