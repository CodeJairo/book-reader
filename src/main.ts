import "./style.css";
import { AppController } from "./app/appController.ts";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("app-container");
  if (container) {
    new AppController(container);
  }
});
