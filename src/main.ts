import "./styles/main.scss"
import { initContactForm } from "./contact-form"
import { initAiHelper } from "./ai-helper"

// Год в футере
const yearEl = document.getElementById("year")
if (yearEl) yearEl.textContent = String(new Date().getFullYear())

// Инициализация модулей
initContactForm()
initAiHelper()
