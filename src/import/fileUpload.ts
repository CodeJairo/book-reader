import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import { BookCreateInput, BookFormat } from "../types/book.ts";

// Configuración del worker de pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedBookData extends BookCreateInput {
  format: BookFormat;
}

export async function processFile(file: File): Promise<ExtractedBookData> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const rawTitle = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

  if (lowerName.endsWith(".pdf")) {
    const { text, numPages } = await extractTextFromPDF(file);
    return {
      title: cleanTitle(rawTitle),
      author: "Documento PDF",
      format: "pdf",
      content: text,
      total_pages_estimated: numPages,
    };
  }

  if (lowerName.endsWith(".docx")) {
    const text = await extractTextFromDOCX(file);
    return {
      title: cleanTitle(rawTitle),
      author: "Documento Word",
      format: "docx",
      content: text,
      total_pages_estimated: Math.max(1, Math.ceil(text.length / 1500)),
    };
  }

  if (lowerName.endsWith(".txt")) {
    const text = await file.text();
    return {
      title: cleanTitle(rawTitle),
      author: "Texto Plano",
      format: "txt",
      content: text,
      total_pages_estimated: Math.max(1, Math.ceil(text.length / 1500)),
    };
  }

  throw new Error("Formato no soportado. Por favor usa archivos PDF, DOCX o TXT.");
}

async function extractTextFromPDF(file: File): Promise<{ text: string; numPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");

    fullText += pageText + "\n\n";
  }

  if (!fullText.trim()) {
    throw new Error(
      "Este PDF no contiene texto digital legible (posiblemente esté escaneado como imagen)."
    );
  }

  return { text: fullText.trim(), numPages: pdf.numPages };
}

async function extractTextFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

function cleanTitle(str: string): string {
  return str
    .split(" ")
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
}
