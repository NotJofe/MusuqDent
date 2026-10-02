import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { createTokenClient, loadGoogleScript } from '../auth/google.js'
import { getConfig, isGoogleConfigured, parseSpreadsheetId, saveConfig } from '../config.js'

export default function Login() {
  const { loginWithGoogle, loginDemo, notice } = useAuth()
  const [configured, setConfigured] = useState(isGoogleConfigured)
  const [showConfig, setShowConfig] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const clientRef = useRef(null)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (!cancelled) clientRef.current = createTokenClient(getConfig().googleClientId)
      })
      .catch((e) => setError(e.message))
    return () => { cancelled = true }
  }, [configured])

  const signIn = async () => {
    if (!clientRef.current) {
      setError('El inicio de sesión de Google aún está cargando. Intenta nuevamente en unos segundos.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const token = await clientRef.current.request('select_account')
      await loginWithGoogle(token)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="./favicon.svg" alt="" width="64" height="64" />
        <h1>MusuqDent</h1>
        <p className="muted">Gestión de pacientes, doctores y citas para tu consultorio dental.</p>

        {notice && <p className="alert alert-warn">{notice}</p>}
        {error && <p className="alert alert-error">{error}</p>}

        {configured ? (
          <button type="button" className="btn btn-google" onClick={signIn} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            {busy ? 'Ingresando…' : 'Ingresar con Google'}
          </button>
        ) : (
          <>
            <p className="alert alert-info">
              Aún no se ha conectado una hoja de Google Sheets. Puedes probar la aplicación en modo demo
              o configurar la conexión.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={loginDemo}>Entrar en modo demo</button>
          </>
        )}

        <button type="button" className="link-btn" onClick={() => setShowConfig((s) => !s)}>
          {showConfig ? 'Ocultar configuración' : 'Configurar conexión con Google'}
        </button>
        {showConfig && (
          <ConnectionForm onSaved={() => { setConfigured(isGoogleConfigured()); setShowConfig(false) }} />
        )}
      </div>
      <p className="login-footer muted">Solo pueden ingresar las cuentas de Google con acceso a la hoja de datos del consultorio.</p>
    </div>
  )
}

export function ConnectionForm({ onSaved }) {
  const cfg = getConfig()
  const [clientId, setClientId] = useState(cfg.googleClientId)
  const [sheet, setSheet] = useState(cfg.spreadsheetId)
  const [emails, setEmails] = useState(cfg.allowedEmails.join(', '))

  const save = (e) => {
    e.preventDefault()
    saveConfig({
      googleClientId: clientId.trim(),
      spreadsheetId: parseSpreadsheetId(sheet),
      allowedEmails: emails,
    })
    onSaved?.()
  }

  return (
    <form className="form connection-form" onSubmit={save}>
      <label>
        <span>OAuth Client ID de Google</span>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="123456-abc.apps.googleusercontent.com" />
      </label>
      <label>
        <span>URL o ID de la hoja de Google Sheets</span>
        <input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
      </label>
      <label>
        <span>Correos autorizados (opcional, separados por coma)</span>
        <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="recepcion@gmail.com, doctora@gmail.com" />
      </label>
      <p className="muted small">Se guarda solo en este navegador. Consulta el README para crear el Client ID.</p>
      <button type="submit" className="btn btn-primary">Guardar</button>
    </form>
  )
}
