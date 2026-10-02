import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { clinicInfo } from '../config.js'
import { useData } from '../data/DataContext.jsx'
import { Avatar } from './ui.jsx'

const NAV = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/agenda', label: 'Agenda', icon: '📅' },
  { to: '/pacientes', label: 'Pacientes', icon: '🧑' },
  { to: '/doctores', label: 'Doctores', icon: '🩺' },
  { to: '/finanzas', label: 'Finanzas', icon: '💰' },
  { to: '/importar', label: 'Importar', icon: '📥' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

export default function Layout() {
  const { user, session, logout } = useAuth()
  const { status, error, saving, reload, sheetUrl } = useData()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMenuOpen(false)
  }

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="./favicon.svg" alt="" width="32" height="32" />
          <div>
            <strong>MusuqDent</strong>
            <small>{clinicInfo().name !== 'MusuqDent' ? clinicInfo().name : 'Gestión dental'}</small>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span aria-hidden="true">{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {session?.mode === 'demo' && <p className="demo-tag">Modo demo: los datos se guardan solo en este navegador.</p>}
          {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer">Abrir hoja de datos ↗</a>}
          <div className="user">
            {user?.picture ? <img src={user.picture} alt="" className="avatar" referrerPolicy="no-referrer" /> : <Avatar name={user?.name} />}
            <div className="user-info">
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </div>
          </div>
          <button type="button" className="btn btn-block" onClick={() => logout()}>Cerrar sesión</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menú">☰</button>
          <span className="topbar-title">MusuqDent</span>
          <span className="spacer" />
          {saving && <span className="saving">Guardando…</span>}
          <button type="button" className="btn btn-small" onClick={reload} disabled={status === 'loading'} title="Volver a leer los datos de la hoja">
            ⟳ Actualizar
          </button>
        </header>
        <main className="content">
          {status === 'loading' && <div className="loading">Cargando datos…</div>}
          {status === 'error' && (
            <div className="alert alert-error">
              <p><strong>No se pudieron cargar los datos.</strong> {error}</p>
              <button type="button" className="btn" onClick={reload}>Reintentar</button>
            </div>
          )}
          {status === 'ready' && <Outlet />}
        </main>
      </div>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    </div>
  )
}
