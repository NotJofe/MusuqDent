import { TABLES } from './schema.js'

// Perú no usa horario de verano: la hora local siempre es UTC-5.
export const LIMA_OFFSET = '-05:00'
export const LIMA_TZ = 'America/Lima'

export function newId(prefix = '') {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14)
  return `${prefix}${Date.now().toString(36)}${rand}`
}

/** Minúsculas, sin tildes ni espacios extra. Útil para búsquedas y para mapear columnas. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function fullName(person) {
  if (!person) return ''
  return [person.nombres, person.apellidos].filter(Boolean).join(' ').trim()
}

export function pad(n) {
  return String(n).padStart(2, '0')
}

/** Fecha de hoy (hora de Lima) en formato YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  return toLimaParts(now).date
}

/** Convierte un Date a fecha y hora local de Lima: { date: 'YYYY-MM-DD', time: 'HH:mm' }. */
export function toLimaParts(date) {
  const shifted = new Date(date.getTime() - 5 * 3600 * 1000)
  const d = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
  const t = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  return { date: d, time: t, datetime: `${d}T${t}` }
}

/** 'YYYY-MM-DDTHH:mm' (hora de Lima) → Date. */
export function limaToDate(localDateTime) {
  if (!localDateTime) return null
  const s = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime
  const d = new Date(`${s}${LIMA_OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Suma minutos a un 'YYYY-MM-DDTHH:mm' en hora de Lima. */
export function addMinutes(localDateTime, minutes) {
  const d = limaToDate(localDateTime)
  if (!d) return ''
  return toLimaParts(new Date(d.getTime() + minutes * 60000)).datetime
}

export function minutesBetween(a, b) {
  const da = limaToDate(a)
  const db = limaToDate(b)
  if (!da || !db) return 0
  return Math.round((db - da) / 60000)
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** 'YYYY-MM-DD' → '02 oct 2026' */
export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return String(iso)
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`
}

/** 'YYYY-MM-DDTHH:mm' → 'lunes 05 oct 2026, 09:30' */
export function formatDateTime(local, { weekday = false } = {}) {
  if (!local) return ''
  const [date, time = ''] = String(local).split('T')
  let out = formatDate(date)
  if (weekday) {
    const d = new Date(`${date}T12:00:00Z`)
    if (!Number.isNaN(d.getTime())) out = `${WEEKDAYS[d.getUTCDay()]} ${out}`
  }
  return time ? `${out}, ${time.slice(0, 5)}` : out
}

export function formatMoney(value) {
  const n = toNumber(value)
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Convierte "1,250.50", "S/ 80" o 80 a número. Vacío o inválido → 0. */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '').replace(/[^0-9.,-]/g, '')
  if (!cleaned) return 0
  // "1.250,50" (formato europeo) → 1250.50 ; "1,250.50" → 1250.50
  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export function age(birthISO, now = new Date()) {
  if (!birthISO) return null
  const [y, m, d] = birthISO.split('-').map(Number)
  if (!y || !m || !d) return null
  const today = todayISO(now).split('-').map(Number)
  let years = today[0] - y
  if (today[1] < m || (today[1] === m && today[2] < d)) years--
  return years >= 0 && years < 150 ? years : null
}

/**
 * Normaliza fechas que vienen de Excel/CSV a 'YYYY-MM-DD'.
 * Acepta Date, número serial de Excel, 'YYYY-MM-DD', 'DD/MM/YYYY' y 'DD-MM-YYYY'.
 */
export function parseDate(value) {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  if (typeof value === 'number' || /^\d{5}(\.\d+)?$/.test(String(value).trim())) {
    // Serial de Excel: días desde 1899-12-30
    const ms = Math.round((Number(value) - 25569) * 86400 * 1000)
    return parseDate(new Date(ms))
  }
  const s = String(value).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return validYMD(m[1], m[2], m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let year = Number(m[3])
    if (year < 100) year += year > 30 ? 1900 : 2000
    return validYMD(year, m[2], m[1])
  }
  return ''
}

function validYMD(y, m, d) {
  const yy = Number(y)
  const mm = Number(m)
  const dd = Number(d)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  const date = new Date(Date.UTC(yy, mm - 1, dd))
  if (date.getUTCMonth() !== mm - 1) return ''
  return `${yy}-${pad(mm)}-${pad(dd)}`
}

/** Deja solo dígitos (y '+' inicial) en un número telefónico. */
export function cleanPhone(phone) {
  const s = String(phone ?? '').trim()
  const digits = s.replace(/\D/g, '')
  return s.startsWith('+') ? `+${digits}` : digits
}

/** Número en formato internacional para WhatsApp (sin '+'). Celulares peruanos: 9 dígitos que empiezan con 9. */
export function whatsappNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`
  if (digits.length === 11 && digits.startsWith('51')) return digits
  return digits
}

/** Valida un registro según el esquema. Devuelve { campo: 'mensaje' }. */
export function validateRecord(table, record, existing = []) {
  const errors = {}
  for (const f of TABLES[table].fields) {
    const v = record[f.key]
    const empty = v === undefined || v === null || String(v).trim() === ''
    if (f.required && empty) {
      errors[f.key] = 'Campo obligatorio'
      continue
    }
    if (empty) continue
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[f.key] = 'Correo inválido'
    if (f.type === 'number' && !Number.isFinite(Number(v))) errors[f.key] = 'Debe ser un número'
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.key] = 'Fecha inválida'
    if (f.unique) {
      const dup = existing.find((r) => r.id !== record.id && normalize(r[f.key]) === normalize(v))
      if (dup) errors[f.key] = 'Ya existe un registro con este valor'
    }
  }
  if (table === 'pacientes' && record.tipoDocumento === 'DNI' && record.numeroDocumento
    && !/^\d{8}$/.test(String(record.numeroDocumento).trim())) {
    errors.numeroDocumento = 'El DNI debe tener 8 dígitos'
  }
  if (table === 'citas' && record.inicio && record.fin && minutesBetween(record.inicio, record.fin) <= 0) {
    errors.fin = 'La hora de fin debe ser posterior al inicio'
  }
  return errors
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sortBy(list, ...keys) {
  return [...list].sort((a, b) => {
    for (const k of keys) {
      const desc = k.startsWith('-')
      const key = desc ? k.slice(1) : k
      const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es', { numeric: true })
      if (cmp) return desc ? -cmp : cmp
    }
    return 0
  })
}
