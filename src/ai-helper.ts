// AI-хелпер для черновика комментария.
// Делает запрос на /api/ai/draft и подставляет результат в textarea.

export function initAiHelper(): void {
  const btn = document.getElementById("ai-helper") as HTMLButtonElement | null
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="comment"]',
  )
  const statusEl = document.getElementById("form-status")
  if (!btn || !textarea) return

  btn.addEventListener("click", async () => {
    const idea = textarea.value.trim()
    if (idea.length < 5) {
      textarea.focus()
      if (statusEl) {
        statusEl.textContent =
          "Напишите 1–2 фразы — о чём ваш запрос, ИИ оформит черновик."
        statusEl.classList.remove("is-success")
        statusEl.classList.add("is-error")
      }
      return
    }

    const original = btn.textContent
    btn.disabled = true
    btn.textContent = "✨ Думаю…"
    if (statusEl) {
      statusEl.textContent = ""
      statusEl.classList.remove("is-error", "is-success")
    }

    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        text?: string
        error?: string
      }

      if (!res.ok || !json.ok || !json.text) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      textarea.value = json.text
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
    } catch (err) {
      console.error("[ai-helper] error:", err)
      if (statusEl) {
        statusEl.textContent =
          "Не удалось сгенерировать текст. Проверьте ключ AI или попробуйте позже."
        statusEl.classList.add("is-error")
      }
    } finally {
      btn.disabled = false
      btn.textContent = original || "✨ AI: помочь с текстом"
    }
  })
}
