import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import { DataProvider } from './data/DataContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Doctors from './pages/Doctors.jsx'
import Finance from './pages/Finance.jsx'
import ImportPage from './pages/ImportPage.jsx'
import Login from './pages/Login.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import Patients from './pages/Patients.jsx'
import Settings from './pages/Settings.jsx'

// El calendario es la parte más pesada: se carga solo cuando se abre la agenda.
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'))

function Protected() {
  const { session } = useAuth()
  if (!session) return <Login />
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pacientes" element={<Patients />} />
          <Route path="pacientes/:id" element={<PatientDetail />} />
          <Route path="doctores" element={<Doctors />} />
          <Route path="agenda" element={<Suspense fallback={<div className="loading">Cargando agenda…</div>}><CalendarPage /></Suspense>} />
          <Route path="finanzas" element={<Finance />} />
          <Route path="importar" element={<ImportPage />} />
          <Route path="configuracion" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

export default function App() {
  // HashRouter: funciona en GitHub Pages sin configurar redirecciones en un servidor.
  return (
    <HashRouter>
      <AuthProvider>
        <Protected />
      </AuthProvider>
    </HashRouter>
  )
}
