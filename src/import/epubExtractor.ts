import JSZip from "jszip";
import { BookFormat, BookCreateInput } from "../types/book.ts";

export interface TOCItem {
  title: string;
  href: string;
}

export interface ExtractedEPUBData extends BookCreateInput {
  format: BookFormat;
  toc?: TOCItem[];
}

export async function extractEPUB(file: File): Promise<ExtractedEPUBData> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Localizar META-INF/container.xml
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("El archivo no es un EPUB válido (falta META-INF/container.xml).");
  }

  const containerXml = await containerFile.async("text");
  const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
  const rootfileEl = containerDoc.querySelector("rootfile");
  const opfPath = rootfileEl?.getAttribute("full-path");

  if (!opfPath) {
    throw new Error("No se pudo localizar el archivo OPF en el paquete EPUB.");
  }

  // Directorio base del OPF (ej. 'OEBPS/' o '')
  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

  // 2. Leer archivo OPF
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`No se encontró el descriptor OPF en la ruta ${opfPath}.`);
  }

  const opfXml = await opfFile.async("text");
  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

  // 3. Metadatos (Título y Autor)
  const titleEl = opfDoc.querySelector("title, dc\\:title");
  const rawTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  const title = titleEl?.textContent?.trim() || cleanTitle(rawTitle);

  const creatorEl = opfDoc.querySelector("creator, dc\\:creator");
  const author = creatorEl?.textContent?.trim() || "Autor desconocido";

  // 4. Mapear Manifest
  const manifestItems = new Map<string, { href: string; mediaType: string; properties?: string }>();
  const manifestElements = opfDoc.querySelectorAll("manifest > item");
  manifestElements.forEach((el) => {
    const id = el.getAttribute("id");
    const href = el.getAttribute("href");
    const mediaType = el.getAttribute("media-type");
    const properties = el.getAttribute("properties") || "";
    if (id && href && mediaType) {
      manifestItems.set(id, { href, mediaType, properties });
    }
  });

  // 5. Extracción de Portada (Cover Image)
  let coverUrl: string | null = null;
  try {
    coverUrl = await extractCover(zip, opfDoc, opfDir, manifestItems);
  } catch (err) {
    console.warn("No se pudo extraer portada del EPUB:", err);
  }

  // 6. Leer Spine (orden oficial de lectura)
  const spineElements = opfDoc.querySelectorAll("spine > itemref");
  const chapterContents: string[] = [];
  const toc: TOCItem[] = [];

  for (const itemRef of Array.from(spineElements)) {
    const idref = itemRef.getAttribute("idref");
    if (!idref) continue;

    const manifestItem = manifestItems.get(idref);
    if (!manifestItem) continue;

    const chapterPath = resolveZipPath(opfDir, manifestItem.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const chapterXml = await chapterFile.async("text");
    const chapterParsed = parseChapterHtml(chapterXml);

    if (chapterParsed.content.trim()) {
      chapterContents.push(chapterParsed.content);
      if (chapterParsed.title) {
        toc.push({ title: chapterParsed.title, href: manifestItem.href });
      }
    }
  }

  if (chapterContents.length === 0) {
    throw new Error("El archivo EPUB no contiene texto legible en su contenido.");
  }

  const fullContent = chapterContents.join("\n\n");
  const estimatedPages = Math.max(1, Math.ceil(fullContent.length / 1500));

  return {
    title,
    author,
    format: "epub",
    cover_url: coverUrl,
    content: fullContent,
    total_pages_estimated: estimatedPages,
    toc,
  };
}

async function extractCover(
  zip: JSZip,
  opfDoc: Document,
  opfDir: string,
  manifestItems: Map<string, { href: string; mediaType: string; properties?: string }>
): Promise<string | null> {
  let coverHref: string | null = null;
  let coverMediaType = "image/jpeg";

  // Buscar por properties="cover-image" (EPUB 3)
  for (const item of manifestItems.values()) {
    if (item.properties && item.properties.includes("cover-image")) {
      coverHref = item.href;
      coverMediaType = item.mediaType;
      break;
    }
  }

  // Buscar por meta[name="cover"] (EPUB 2)
  if (!coverHref) {
    const metaCover = opfDoc.querySelector('meta[name="cover"]');
    const coverId = metaCover?.getAttribute("content");
    if (coverId && manifestItems.has(coverId)) {
      const item = manifestItems.get(coverId)!;
      coverHref = item.href;
      coverMediaType = item.mediaType;
    }
  }

  // Fallback por ID o nombre href que contenga 'cover'
  if (!coverHref) {
    for (const [id, item] of manifestItems.entries()) {
      if (
        item.mediaType.startsWith("image/") &&
        (id.toLowerCase().includes("cover") || item.href.toLowerCase().includes("cover"))
      ) {
        coverHref = item.href;
        coverMediaType = item.mediaType;
        break;
      }
    }
  }

  if (!coverHref) return null;

  const fullCoverPath = resolveZipPath(opfDir, coverHref);
  const coverZipFile = zip.file(fullCoverPath);
  if (!coverZipFile) return null;

  const base64Data = await coverZipFile.async("base64");
  return `data:${coverMediaType};base64,${base64Data}`;
}

function parseChapterHtml(htmlStr: string): { title: string | null; content: string } {
  const parser = new DOMParser();
  // Intentar parsear como text/html
  const doc = parser.parseFromString(htmlStr, "text/html");

  // Eliminar scripts, estilos e imágenes rotas para lectura limpia
  doc.querySelectorAll("script, style, link, svg").forEach((el) => el.remove());

  // Buscar título de capítulo si existe (h1, h2, h3 o title del head)
  const heading = doc.querySelector("h1, h2, h3");
  const chapterTitle = heading ? heading.textContent?.trim() || null : null;

  // Extraer párrafos y encabezados limpios
  const body = doc.body;
  if (!body) return { title: null, content: "" };

  const nodes = body.querySelectorAll("h1, h2, h3, h4, p, blockquote, li");
  const extractedLines: string[] = [];

  nodes.forEach((node) => {
    const text = node.textContent?.trim();
    if (text && text.length > 0) {
      const tag = node.tagName.toLowerCase();
      if (tag.startsWith("h")) {
        extractedLines.push(`\n## ${text}\n`);
      } else {
        extractedLines.push(text);
      }
    }
  });

  // Si no se encontraron etiquetas semánticas estándar, fallback al innerText del body
  let result = extractedLines.length > 0 ? extractedLines.join("\n\n") : body.innerText || "";

  // Normalizar saltos de línea repetidos
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return {
    title: chapterTitle,
    content: result,
  };
}

function resolveZipPath(baseDir: string, relativePath: string): string {
  // Limpiar leading slashes
  let cleanRel = relativePath.replace(/^(\.\/|\/)+/, "");

  if (cleanRel.startsWith("../")) {
    const parts = baseDir.split("/").filter(Boolean);
    while (cleanRel.startsWith("../") && parts.length > 0) {
      cleanRel = cleanRel.substring(3);
      parts.pop();
    }
    const newBase = parts.length > 0 ? parts.join("/") + "/" : "";
    return newBase + cleanRel;
  }

  return baseDir + cleanRel;
}

function cleanTitle(str: string): string {
  return str
    .split(" ")
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
}
