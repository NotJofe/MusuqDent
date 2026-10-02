// Configuración de la aplicación. Los valores pueden venir de variables de entorno en el
// build (VITE_*) o configurarse desde la propia app; lo guardado en el navegador tiene prioridad.

const STORAGE_KEY = 'musuqdent.config'

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function getConfig() {
  const env = import.meta.env ?? {}
  const stored = readStored()
  return {
    googleClientId: stored.googleClientId || env.VITE_GOOGLE_CLIENT_ID || '',
    spreadsheetId: stored.spreadsheetId || env.VITE_SPREADSHEET_ID || '',
    allowedEmails: (stored.allowedEmails ?? env.VITE_ALLOWED_EMAILS ?? '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    clinicName: stored.clinicName || env.VITE_CLINIC_NAME || 'MusuqDent',
    clinicAddress: stored.clinicAddress || env.VITE_CLINIC_ADDRESS || '',
    clinicPhone: stored.clinicPhone || env.VITE_CLINIC_PHONE || '',
  }
}

export function saveConfig(patch) {
  const next = { ...readStored(), ...patch }
  if (Array.isArray(next.allowedEmails)) next.allowedEmails = next.allowedEmails.join(',')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function isGoogleConfigured() {
  const c = getConfig()
  return Boolean(c.googleClientId && c.spreadsheetId)
}

export function clinicInfo() {
  const c = getConfig()
  return { name: c.clinicName, address: c.clinicAddress, phone: c.clinicPhone }
}

/** Extrae el ID si el usuario pega la URL completa de la hoja. */
export function parseSpreadsheetId(input) {
  const s = String(input ?? '').trim()
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : s
}
