import "./style.css";
import { AppController } from "./app/appController.ts";

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("book_reader_theme") || "claro";
  document.body.setAttribute("data-theme", savedTheme);

  const container = document.getElementById("app-container");
  if (container) {
    new AppController(container);
  }
});
