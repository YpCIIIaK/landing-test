// Node.js + Express бэкенд для формы и AI.
// Зависимости: express, cors, dotenv, nodemailer, express-rate-limit

require("dotenv").config()
const path = require("path")
const express = require("express")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
const nodemailer = require("nodemailer")

const {
  validateContact,
  escapeHtml,
  buildOwnerEmail,
  buildUserEmail,
} = require("./utils")

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === "production"

// Railway/Render/Fly работают за обратным прокси и подставляют X-Forwarded-For.
// Без trust proxy express-rate-limit падает с ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
// Доверяем одному уровню прокси — этого достаточно для большинства PaaS.
app.set("trust proxy", 1)

app.use(express.json({ limit: "100kb" }))
// В dev фронт работает с другого порта — разрешаем CORS.
// В проде фронт отдаётся тем же сервером, CORS не нужен.
if (!isProd) {
  app.use(cors({ origin: true }))
}

// Простая защита от спама
const formLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Слишком много запросов. Попробуйте через минуту." },
})
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Слишком много AI-запросов. Подождите немного." },
})

// ---------- Транспорт почты ----------
let transporter = null
function getTransporter() {
  if (transporter) return transporter
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[mail] SMTP не настроен — письма отправляться не будут. Заполните .env (см. .env.example).",
    )
    return null
  }

  const port = Number(SMTP_PORT) || 465
  // Если SMTP_SECURE задан явно — используем его. Иначе авто: 465 = SSL (true), 587/25 = STARTTLS (false).
  const secure =
    SMTP_SECURE !== undefined
      ? String(SMTP_SECURE).toLowerCase() === "true"
      : port === 465

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Явные таймауты, чтобы при сетевых проблемах не висеть до бесконечности.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })

  // Один раз проверяем соединение и логируем результат — удобно для дебага на хостинге.
  transporter.verify().then(
    () => console.log(`[mail] SMTP ready (${SMTP_HOST}:${port}, secure=${secure})`),
    (err) => console.error("[mail] SMTP verify failed:", err.message),
  )

  return transporter
}

// ---------- Health ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

// ---------- Контактная форма ----------
app.post("/api/contact", formLimiter, async (req, res) => {
  try {
    const data = {
      name: String(req.body?.name || "").trim(),
      phone: String(req.body?.phone || "").trim(),
      email: String(req.body?.email || "").trim(),
      comment: String(req.body?.comment || "").trim(),
    }

    const errors = validateContact(data)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ ok: false, errors })
    }

    const tr = getTransporter()
    const ownerEmail = process.env.OWNER_EMAIL
    const from = process.env.MAIL_FROM || process.env.SMTP_USER

    if (!tr || !ownerEmail || !from) {
      // Если SMTP не настроен — логируем заявку и говорим клиенту, что что-то не так на сервере.
      console.warn("[contact] SMTP/OWNER_EMAIL не настроены. Заявка:", data)
      return res.status(500).json({
        ok: false,
        error:
          "Сервер не настроен для отправки писем. Заявка сохранена в логах.",
      })
    }

    // Письмо владельцу
    const ownerMail = {
      from,
      to: ownerEmail,
      replyTo: data.email,
      subject: `Новая заявка с лендинга — ${data.name}`,
      text: buildOwnerEmail(data, "text"),
      html: buildOwnerEmail(data, "html"),
    }
    // Копия пользователю
    const userMail = {
      from,
      to: data.email,
      subject: "Спасибо! Ваша заявка получена",
      text: buildUserEmail(data, "text"),
      html: buildUserEmail(data, "html"),
    }

    // Отправляем параллельно. Если падает копия пользователю — это не критично,
    // главное что письмо владельцу ушло.
    const [ownerResult, userResult] = await Promise.allSettled([
      tr.sendMail(ownerMail),
      tr.sendMail(userMail),
    ])

    if (ownerResult.status === "rejected") {
      console.error("[contact] owner mail failed:", ownerResult.reason)
      return res.status(502).json({
        ok: false,
        error: "Не удалось отправить письмо. Попробуйте позже.",
      })
    }
    if (userResult.status === "rejected") {
      console.warn("[contact] user copy failed:", userResult.reason)
    }

    return res.json({
      ok: true,
      userCopySent: userResult.status === "fulfilled",
    })
  } catch (err) {
    console.error("[contact] unexpected error:", err)
    return res.status(500).json({ ok: false, error: "Внутренняя ошибка сервера" })
  }
})

// ---------- AI: черновик комментария через OpenRouter ----------
app.post("/api/ai/draft", aiLimiter, async (req, res) => {
  try {
    const idea = String(req.body?.idea || "").trim()
    if (idea.length < 5 || idea.length > 1000) {
      return res
        .status(400)
        .json({ ok: false, error: "Идея должна б��ть длиной 5–1000 символов" })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "AI не настроен: укажите OPENROUTER_API_KEY в .env",
      })
    }

    const systemPrompt = [
      "Ты — помощник, который пишет короткие, дружелюбные сообщения от лица пользователя",
      "для отправки разработчику через форму обратной связи.",
      "Пиши на русском, в 2–4 предложениях, по делу, без воды и без приветствий вроде «Здравствуйте».",
      "Не выдумывай факты, опирайся только на идею пользователя.",
      "Возвращай ТОЛЬКО текст комментария, без кавычек и подписей.",
    ].join(" ")

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/",
        "X-Title": "Dev Landing",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Идея пользователя: ${idea}` },
        ],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "")
      console.error("[ai] openrouter error:", aiRes.status, errText)
      return res.status(502).json({
        ok: false,
        error: `AI-сервис вернул ошибку (HTTP ${aiRes.status})`,
      })
    }

    const json = await aiRes.json()
    const text =
      json?.choices?.[0]?.message?.content?.trim?.() ||
      ""
    if (!text) {
      return res.status(502).json({ ok: false, error: "AI вернул пустой ответ" })
    }

    return res.json({ ok: true, text })
  } catch (err) {
    console.error("[ai] unexpected error:", err)
    return res.status(500).json({ ok: false, error: "Внутренняя ошибка сервера" })
  }
})

// ---------- Раздача собранного фронта ----------
// Раздаём dist/ всегда, если папка существует (после vite build).
// Так проще для деплоя на Railway/Render: не зависим от NODE_ENV.
const fs = require("fs")
const distDir = path.resolve(__dirname, "..", "dist")
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"))
  })
} else {
  console.warn(
    "[server] dist/ not found — фронт не собран. Запустите `npm run build`.",
  )
}

// Глобальный обработчик ошибок
app.use((err, _req, res, _next) => {
  console.error("[server] unhandled:", err)
  res.status(500).json({ ok: false, error: "Внутренняя ошибка сервера" })
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (${process.env.NODE_ENV || "development"})`)
})

// Используется только утилитами выше (для тестов при необ��одимости)
module.exports = { escapeHtml }
