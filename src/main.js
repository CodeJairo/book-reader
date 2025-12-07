import "./style.css";
import { initFileUpload } from "./fileUpload.js";
import { initTextToSpeech } from "./textToSpeech.js";

async function loadAppContent() {
  const response = await fetch("/app.html");
  const html = await response.text();
  document.getElementById("app-container").innerHTML = html;
  initializeApp();
}

function initializeApp() {
  const inputText = document.getElementById("inputText");
  const renderBtn = document.getElementById("renderBtn");
  const readingArea = document.getElementById("readingArea");
  const fontDown = document.getElementById("fontDown");
  const fontUp = document.getElementById("fontUp");
  const fontSizeLabel = document.getElementById("fontSizeLabel");
  const themeButtons = document.querySelectorAll("[data-theme-btn]");
  const body = document.body;

  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  const pageCounter = document.getElementById("pageCounter");
  const pageIndicatorTop = document.getElementById("pageIndicatorTop");

  let fontSize = 18; // px
  let currentPage = 0;
  let totalPages = 1;
  let paginationTimeout = null;

  function updateFontSize() {
    readingArea.style.fontSize = fontSize + "px";
    fontSizeLabel.textContent = fontSize + " px";
    schedulePaginationUpdate();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderTextAsBook() {
    const raw = inputText.value.trim();
    if (!raw) {
      alert("Primero pega algún texto en el recuadro de arriba 🙂");
      return;
    }

    const paragraphs = raw
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const html = paragraphs
      .map((p) => {
        const clean = escapeHtml(p).replace(/\n+/g, " ");
        return `<p>${clean}</p>`;
      })
      .join("\n");

    readingArea.innerHTML = html;
    readingArea.scrollTop = 0;
    currentPage = 0;
    updatePagination();
  }

  function updatePagination() {
    readingArea.classList.remove("two-column-layout");

    requestAnimationFrame(() => {
      const viewHeight = readingArea.clientHeight || 1;
      const contentHeight = readingArea.scrollHeight || 1;

      totalPages = Math.max(1, Math.ceil(contentHeight / viewHeight));

      if (totalPages === 1 && window.innerWidth > 900) {
        readingArea.classList.add("two-column-layout");
      }

      if (currentPage > totalPages - 1) {
        currentPage = totalPages - 1;
      }
      goToPage(currentPage, false);
      updatePageIndicator();
      updateNavButtons();
    });
  }

  function schedulePaginationUpdate() {
    if (paginationTimeout) {
      clearTimeout(paginationTimeout);
    }
    paginationTimeout = setTimeout(updatePagination, 150);
  }

  function goToPage(index, animate = true, direction = "forward") {
    if (totalPages <= 1) {
      currentPage = 0;
      readingArea.scrollTop = 0;
      updatePageIndicator();
      updateNavButtons();
      return;
    }

    currentPage = Math.max(0, Math.min(index, totalPages - 1));
    const targetScrollTop = currentPage * readingArea.clientHeight;

    if (animate) {
      const animClass =
        direction === "backward" ? "turn-backward" : "turn-forward";
      readingArea.classList.remove("turn-forward", "turn-backward");
      void readingArea.offsetWidth; // reiniciar animación
      readingArea.classList.add(animClass);

      readingArea.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });

      setTimeout(() => {
        readingArea.classList.remove(animClass);
      }, 400);
    } else {
      readingArea.scrollTop = targetScrollTop;
    }

    updatePageIndicator();
    updateNavButtons();
  }

  function updatePageIndicator() {
    const pageNumber = currentPage + 1;
    pageCounter.textContent = `Página ${pageNumber} / ${totalPages}`;
    pageIndicatorTop.textContent =
      totalPages > 1
        ? `Página ${pageNumber} de ${totalPages}`
        : "Vista tipo libro";
  }

  function updateNavButtons() {
    prevPageBtn.disabled = currentPage <= 0;
    nextPageBtn.disabled = currentPage >= totalPages - 1;
  }

  renderBtn.addEventListener("click", renderTextAsBook);

  fontUp.addEventListener("click", () => {
    fontSize = Math.min(28, fontSize + 1);
    updateFontSize();
  });

  fontDown.addEventListener("click", () => {
    fontSize = Math.max(14, fontSize - 1);
    updateFontSize();
  });

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.getAttribute("data-theme");
      body.setAttribute("data-theme", theme);

      themeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1, true, "backward");
    }
  });

  nextPageBtn.addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1, true, "forward");
    }
  });

  window.addEventListener("resize", () => {
    schedulePaginationUpdate();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" && !prevPageBtn.disabled) {
      goToPage(currentPage - 1, true, "backward");
    } else if (e.key === "ArrowRight" && !nextPageBtn.disabled) {
      goToPage(currentPage + 1, true, "forward");
    } else if ((e.key === "+" || e.key === "=") && e.target !== inputText) {
      e.preventDefault();
      fontSize = Math.min(28, fontSize + 1);
      updateFontSize();
    } else if (e.key === "-" && e.target !== inputText) {
      e.preventDefault();
      fontSize = Math.max(14, fontSize - 1);
      updateFontSize();
    }
  });

  updateFontSize();
  updatePagination();

  const fileInput = document.getElementById("fileInput");
  const fileStatus = document.getElementById("fileStatus");

  initFileUpload(
    fileInput,
    inputText,
    (fileName, text) => {
      fileStatus.textContent = `✓ ${fileName} cargado`;
      setTimeout(() => {
        fileStatus.textContent = "";
      }, 3000);
    },
    (error) => {
      fileStatus.textContent = `✗ Error: ${error.message}`;
      setTimeout(() => {
        fileStatus.textContent = "";
      }, 5000);
    }
  );

  const ttsElements = {
    playBtn: document.getElementById("ttsPlay"),
    pauseBtn: document.getElementById("ttsPause"),
    stopBtn: document.getElementById("ttsStop"),
    voiceSelect: document.getElementById("voiceSelect"),
    rateControl: document.getElementById("rateControl"),
    rateLabel: document.getElementById("rateLabel"),
    pitchControl: document.getElementById("pitchControl"),
    pitchLabel: document.getElementById("pitchLabel"),
  };

  initTextToSpeech(ttsElements, () => inputText.value);
}

loadAppContent();
