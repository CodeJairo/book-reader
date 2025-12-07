import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");

    fullText += pageText + "\n\n";
  }

  return fullText.trim();
}

async function extractTextFromDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

async function extractTextFromTXT(file) {
  return file.text();
}

// Decide which extractor to use based on file extension.
export async function processFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    return extractTextFromPDF(file);
  }

  if (fileName.endsWith(".docx")) {
    return extractTextFromDOCX(file);
  }

  if (fileName.endsWith(".txt")) {
    return extractTextFromTXT(file);
  }

  throw new Error("Unsupported file type. Use PDF, DOCX or TXT.");
}

// Connect a file input to a textarea
export function initFileUpload(fileInput, textarea, onSuccess, onError) {
  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await processFile(file);
      textarea.value = text;

      if (typeof onSuccess === "function") {
        onSuccess(file.name, text);
      }
    } catch (error) {
      console.error("Error processing file:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    }
  });
}
