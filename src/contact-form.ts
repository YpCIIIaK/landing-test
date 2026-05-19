import { validate, type ContactFormData, type ValidationErrors } from "./validation"

type Status = "idle" | "loading" | "success" | "error"

export function initContactForm(): void {
  const form = document.getElementById("contact-form") as HTMLFormElement | null
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null
  const statusEl = document.getElementById("form-status") as HTMLParagraphElement | null
  if (!form || !submitBtn || !statusEl) return

  const setStatus = (status: Status, message = "") => {
    statusEl.textContent = message
    statusEl.classList.remove("is-success", "is-error")
    if (status === "success") statusEl.classList.add("is-success")
    if (status === "error") statusEl.classList.add("is-error")

    if (status === "loading") {
      submitBtn.classList.add("is-loading")
      submitBtn.disabled = true
    } else {
      submitBtn.classList.remove("is-loading")
      submitBtn.disabled = false
    }
  }

  const showErrors = (errors: ValidationErrors) => {
    // Сбрасываем все поля
    form.querySelectorAll<HTMLElement>(".form__field").forEach((el) => {
      el.classList.remove("is-invalid")
    })
    form.querySelectorAll<HTMLElement>("[data-error]").forEach((el) => {
      el.textContent = ""
    })
    // Расставляем актуальные
    ;(Object.keys(errors) as (keyof ContactFormData)[]).forEach((field) => {
      const input = form.elements.namedItem(field) as HTMLInputElement | null
      const errorEl = form.querySelector<HTMLElement>(`[data-error="${field}"]`)
      if (input) input.closest(".form__field")?.classList.add("is-invalid")
      if (errorEl) errorEl.textContent = errors[field] || ""
    })
  }

  // Снимаем ошибку при вводе
  form.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement
    target.closest(".form__field")?.classList.remove("is-invalid")
    const errorEl = form.querySelector<HTMLElement>(`[data-error="${target.name}"]`)
    if (errorEl) errorEl.textContent = ""
  })

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const data: ContactFormData = {
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      comment: String(fd.get("comment") || "").trim(),
    }

    const errors = validate(data)
    if (Object.keys(errors).length > 0) {
      showErrors(errors)
      setStatus("error", "Проверьте поля формы")
      return
    }
    showErrors({})
    setStatus("loading", "Отправляем…")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        errors?: ValidationErrors
      }

      if (!res.ok || !json.ok) {
        if (json.errors) {
          showErrors(json.errors)
          setStatus("error", "Сервер отклонил данные. Проверьте поля.")
        } else {
          setStatus(
            "error",
            json.error || `Ошибка отправки (HTTP ${res.status}). Попробуйте позже.`,
          )
        }
        return
      }

      setStatus(
        "success",
        "Готово! Я получил заявку, копия письма ушла вам на email.",
      )
      form.reset()
    } catch (err) {
      console.error("[contact-form] network error:", err)
      setStatus("error", "Сеть недоступна. Проверьте соединение и попробуйте снова.")
    }
  })
}
