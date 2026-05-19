// Утилиты для валидации и шаблонов писем — без зависимостей.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const PHONE_RE = /^[+\d][\d\s\-()]{5,31}$/

function validateContact(data) {
  const errors = {}

  if (!data.name || data.name.trim().length < 2) {
    errors.name = "Введите имя (минимум 2 символа)"
  } else if (data.name.length > 80) {
    errors.name = "Слишком длинное имя"
  }

  if (!data.phone || !PHONE_RE.test(data.phone.trim())) {
    errors.phone = "Введите корректный телефон"
  }

  if (!data.email || !EMAIL_RE.test(data.email.trim())) {
    errors.email = "Введите корректный email"
  }

  if (data.comment && data.comment.length > 2000) {
    errors.comment = "Комментарий слишком длинный (макс. 2000)"
  }

  return errors
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildOwnerEmail(data, format) {
  if (format === "text") {
    return [
      "Новая заявка с лендинга",
      "",
      `Имя:    ${data.name}`,
      `Телефон: ${data.phone}`,
      `Email:   ${data.email}`,
      "",
      "Комментарий:",
      data.comment || "(пусто)",
    ].join("\n")
  }
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#111">
      <h2 style="margin:0 0 12px">Новая заявка с лендинга</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#666;width:120px">Имя</td><td>${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Телефон</td><td>${escapeHtml(data.phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td>${escapeHtml(data.email)}</td></tr>
      </table>
      <h3 style="margin:18px 0 6px;font-size:14px;color:#666">Комментарий</h3>
      <div style="white-space:pre-wrap;background:#f6f7f9;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:14px">${escapeHtml(data.comment) || "<i>(пусто)</i>"}</div>
    </div>
  `
}

function buildUserEmail(data, format) {
  if (format === "text") {
    return [
      `Привет, ${data.name}!`,
      "",
      "Спасибо за заявку — я её получил и отвечу в ближайшее время.",
      "Ниже копия данных, которые вы отправили:",
      "",
      `Телефон: ${data.phone}`,
      `Email:   ${data.email}`,
      "Комментарий:",
      data.comment || "(пусто)",
      "",
      "— Отправлено автоматически с лендинга",
    ].join("\n")
  }
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#111">
      <h2 style="margin:0 0 12px">Спасибо, ${escapeHtml(data.name)}!</h2>
      <p>Я получил вашу заявку и свяжусь с вами в ближайшее время.</p>
      <h3 style="margin:18px 0 6px;font-size:14px;color:#666">Копия ваших данных</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#666;width:120px">Телефон</td><td>${escapeHtml(data.phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td>${escapeHtml(data.email)}</td></tr>
      </table>
      <h3 style="margin:18px 0 6px;font-size:14px;color:#666">Комментарий</h3>
      <div style="white-space:pre-wrap;background:#f6f7f9;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:14px">${escapeHtml(data.comment) || "<i>(пусто)</i>"}</div>
      <p style="margin-top:18px;color:#888;font-size:12px">Это автоматическое письмо-подтверждение.</p>
    </div>
  `
}

module.exports = { validateContact, escapeHtml, buildOwnerEmail, buildUserEmail }
