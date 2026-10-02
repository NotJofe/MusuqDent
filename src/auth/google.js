// Inicio de sesión con Google Identity Services (OAuth 2.0 en el navegador, sin backend).
// El token obtenido permite leer/escribir la hoja de Google Sheets en nombre del usuario.

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ')

let scriptPromise = null

export function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('No se pudo cargar el inicio de sesión de Google. Revisa tu conexión a internet.'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Crea un cliente de tokens. Debe crearse antes del clic del usuario para que el navegador
 * no bloquee la ventana emergente de Google.
 */
export function createTokenClient(clientId) {
  let pending = null
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp) => {
      if (!pending) return
      if (resp.error) pending.reject(new Error(resp.error_description || resp.error))
      else pending.resolve(resp)
      pending = null
    },
    error_callback: (err) => {
      if (!pending) return
      pending.reject(new Error(err?.type === 'popup_closed' ? 'Se cerró la ventana de Google.' : (err?.message || 'Error al iniciar sesión.')))
      pending = null
    },
  })
  return {
    request(prompt = '') {
      return new Promise((resolve, reject) => {
        pending = { resolve, reject }
        client.requestAccessToken({ prompt })
      })
    },
  }
}

export function hasRequiredScopes(tokenResponse) {
  return window.google.accounts.oauth2.hasGrantedAllScopes(
    tokenResponse,
    'https://www.googleapis.com/auth/spreadsheets',
  )
}

export async function fetchUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener la información de la cuenta de Google.')
  return res.json()
}

export function revokeToken(accessToken) {
  try {
    window.google?.accounts?.oauth2?.revoke(accessToken, () => {})
  } catch { /* sin efecto si ya expiró */ }
}
