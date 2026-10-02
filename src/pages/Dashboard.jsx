import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { StateBadge } from '../components/ui.jsx'
import { useData } from '../data/DataContext.jsx'
import { balancesByPatient, sumBy } from '../lib/finance.js'
import { whatsappLink } from '../lib/share.js'
import { formatDate, formatMoney, fullName, sortBy, todayISO } from '../lib/utils.js'

export default function Dashboard() {
  const { pacientes, citas, pagos, atenciones, byId } = useData()
  const today = todayISO()

  const stats = useMemo(() => {
    const in7 = new Date(`${today}T12:00:00Z`)
    in7.setUTCDate(in7.getUTCDate() + 7)
    const limit = in7.toISOString().slice(0, 10)
    const active = citas.filter((c) => c.estado !== 'Cancelada')
    const balances = balancesByPatient(atenciones, pagos)
    return {
      hoy: sortBy(active.filter((c) => c.inicio.slice(0, 10) === today), 'inicio'),
      semana: active.filter((c) => c.inicio.slice(0, 10) > today && c.inicio.slice(0, 10) <= limit).length,
      ingresosMes: sumBy(pagos.filter((p) => p.fecha.slice(0, 7) === today.slice(0, 7)), 'monto'),
      deudores: [...balances.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]),
      cumpleanos: pacientes.filter((p) => p.fechaNacimiento && p.fechaNacimiento.slice(5) === today.slice(5)),
    }
  }, [citas, pagos, atenciones, pacientes, today])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Inicio</h1>
          <p className="muted">{formatDate(today)}</p>
        </div>
        <Link to="/agenda" className="btn btn-primary">+ Nueva cita</Link>
      </div>

      <div className="stats">
        <div className="stat"><span>Citas hoy</span><strong>{stats.hoy.length}</strong></div>
        <div className="stat"><span>Próximos 7 días</span><strong>{stats.semana}</strong></div>
        <div className="stat"><span>Pacientes</span><strong>{pacientes.length}</strong></div>
        <div className="stat"><span>Ingresos del mes</span><strong>{formatMoney(stats.ingresosMes)}</strong></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Citas de hoy</h2>
          {stats.hoy.length === 0 && <p className="muted">No hay citas programadas para hoy.</p>}
          <ul className="list">
            {stats.hoy.map((c) => {
              const p = byId.pacientes[c.pacienteId]
              const d = byId.doctores[c.doctorId]
              return (
                <li key={c.id} className="list-row">
                  <span className="time" style={{ borderColor: d?.color }}>{c.inicio.slice(11, 16)}</span>
                  <div className="grow">
                    {p ? <Link to={`/pacientes/${p.id}`}><strong>{fullName(p)}</strong></Link> : <strong>Paciente eliminado</strong>}
                    <div className="muted small">{c.motivo}{d ? ` · Dr(a). ${fullName(d)}` : ''}</div>
                  </div>
                  <StateBadge estado={c.estado} />
                  {p && <a className="btn btn-small btn-whatsapp" href={whatsappLink(c, p, d)} target="_blank" rel="noreferrer" title="Enviar recordatorio por WhatsApp">WhatsApp</a>}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card">
          <h2>Saldos pendientes</h2>
          {stats.deudores.length === 0 && <p className="muted">Ningún paciente tiene saldo pendiente.</p>}
          <ul className="list">
            {stats.deudores.slice(0, 8).map(([id, saldo]) => (
              <li key={id} className="list-row">
                <div className="grow">
                  {byId.pacientes[id] ? <Link to={`/pacientes/${id}`}>{fullName(byId.pacientes[id])}</Link> : 'Paciente eliminado'}
                </div>
                <strong className="text-danger">{formatMoney(saldo)}</strong>
              </li>
            ))}
          </ul>
          {stats.cumpleanos.length > 0 && (
            <>
              <h2>🎂 Cumpleaños de hoy</h2>
              <ul className="list">
                {stats.cumpleanos.map((p) => (
                  <li key={p.id} className="list-row"><Link to={`/pacientes/${p.id}`}>{fullName(p)}</Link></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
