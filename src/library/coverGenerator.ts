const PALETTES = [
  { bg1: "#1e3c72", bg2: "#2a5298", text: "#ffffff" },
  { bg1: "#134e5e", bg2: "#71b280", text: "#ffffff" },
  { bg1: "#3a1c71", bg2: "#d76d77", text: "#ffffff" },
  { bg1: "#2b5876", bg2: "#4e4376", text: "#ffffff" },
  { bg1: "#4b1248", bg2: "#f0c27b", text: "#ffffff" },
  { bg1: "#1f4037", bg2: "#99f2c8", text: "#ffffff" },
  { bg1: "#2c3e50", bg2: "#3498db", text: "#ffffff" },
  { bg1: "#870000", bg2: "#190a05", text: "#ffffff" },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateBookCover(title: string, author = "Desconocido"): string {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 460;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  const paletteIndex = hashString(title + author) % PALETTES.length;
  const palette = PALETTES[paletteIndex];

  // Fondo con gradiente diagonal
  const gradient = ctx.createLinearGradient(0, 0, 320, 460);
  gradient.addColorStop(0, palette.bg1);
  gradient.addColorStop(1, palette.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 320, 460);

  // Efecto de lomo de libro (borde izquierdo con sombra)
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(0, 0, 24, 460);
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(24, 0, 4, 460);

  // Marco decorativo fino
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 24, 256, 412);

  // Título
  ctx.fillStyle = palette.text;
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = title.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 220 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 4) break;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < 4) {
    lines.push(currentLine);
  }

  const startY = 170 - (lines.length * 15);
  lines.forEach((line, index) => {
    ctx.fillText(line, 164, startY + index * 30);
  });

  // Línea divisoria
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(114, 280, 100, 2);

  // Autor
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(author, 164, 320);

  // Icono o sello de libro en la parte inferior
  ctx.font = "24px sans-serif";
  ctx.fillText("📖", 164, 385);

  return canvas.toDataURL("image/png");
}
