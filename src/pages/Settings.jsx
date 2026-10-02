import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { getConfig, saveConfig } from '../config.js'
import { useData } from '../data/DataContext.jsx'
import { LocalStore } from '../data/localStore.js'
import { TABLE_NAMES } from '../lib/schema.js'
import { downloadFile, todayISO } from '../lib/utils.js'
import { ConnectionForm } from './Login.jsx'

export default function Settings() {
  const { session, logout } = useAuth()
  const data = useData()
  const cfg = getConfig()
  const [clinic, setClinic] = useState({ clinicName: cfg.clinicName, clinicAddress: cfg.clinicAddress, clinicPhone: cfg.clinicPhone })
  const [saved, setSaved] = useState(false)

  const saveClinic = (e) => {
    e.preventDefault()
    saveConfig(clinic)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const backup = () => {
    const out = Object.fromEntries(TABLE_NAMES.map((t) => [t, data[t]]))
    downloadFile(`musuqdent-respaldo-${todayISO()}.json`, JSON.stringify(out, null, 2), 'application/json')
  }

  return (
    <div className="page">
      <div className="page-header"><h1>Configuración</h1></div>

      <section className="card">
        <h2>Datos del consultorio</h2>
        <p className="muted small">Se usan en los mensajes y recordatorios que se comparten con los pacientes.</p>
        <form className="form form-grid" onSubmit={saveClinic}>
          <label><span>Nombre del consultorio</span><input value={clinic.clinicName} onChange={(e) => setClinic({ ...clinic, clinicName: e.target.value })} /></label>
          <label><span>Teléfono / WhatsApp</span><input value={clinic.clinicPhone} onChange={(e) => setClinic({ ...clinic, clinicPhone: e.target.value })} /></label>
          <label className="span-2"><span>Dirección</span><input value={clinic.clinicAddress} onChange={(e) => setClinic({ ...clinic, clinicAddress: e.target.value })} /></label>
          <div className="span-2 form-actions"><span className="spacer" />{saved && <span className="text-ok">Guardado</span>}<button type="submit" className="btn btn-primary">Guardar</button></div>
        </form>
      </section>

      <section className="card">
        <h2>Base de datos</h2>
        {session.mode === 'google' ? (
          <p>Los datos se guardan en la hoja de Google Sheets: <a href={data.sheetUrl} target="_blank" rel="noreferrer">abrir hoja ↗</a>. Para dar acceso a otra persona, comparte la hoja con su cuenta de Google como <em>Editor</em>.</p>
        ) : (
          <p>Estás en <strong>modo demo</strong>: los datos se guardan solo en este navegador.</p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={backup}>Descargar respaldo (JSON)</button>
          {session.mode === 'demo' && (
            <button type="button" className="btn btn-danger" onClick={() => {
              if (!window.confirm('¿Borrar los datos de demostración y empezar de nuevo?')) return
              LocalStore.reset()
              data.reload()
            }}
            >Reiniciar datos demo</button>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Conexión con Google</h2>
        <p className="muted small">Al cambiar la conexión se cerrará la sesión.</p>
        <ConnectionForm onSaved={() => logout('Conexión actualizada. Ingresa nuevamente.')} />
      </section>
    </div>
  )
}
