// Простая клиентская валидация без зависимостей.
// Возвращает объект ошибок: { field: "сообщение" }

export type ContactFormData = {
  name: string
  phone: string
  email: string
  comment: string
}

export type ValidationErrors = Partial<Record<keyof ContactFormData, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
// Допускаем +, цифры, пробелы, скобки и тире — длиной 6..32
const PHONE_RE = /^[+\d][\d\s\-()]{5,31}$/

export function validate(data: ContactFormData): ValidationErrors {
  const errors: ValidationErrors = {}

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
