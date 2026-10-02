import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppointmentModal from '../components/AppointmentModal.jsx'
import { EmptyState, Modal, RecordForm, StateBadge } from '../components/ui.jsx'
import { useData } from '../data/DataContext.jsx'
import { patientBalance } from '../lib/finance.js'
import { emptyRecord } from '../lib/schema.js'
import { age, formatDate, formatDateTime, formatMoney, fullName, sortBy, todayISO, toLimaParts, whatsappNumber } from '../lib/utils.js'

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useData()
  const { byId, atenciones, pagos, citas, create, update, remove } = data
  const paciente = byId.pacientes[id]
  const [tab, setTab] = useState('historial')
  const [modal, setModal] = useState(null) // { kind, record }

  const mine = useMemo(() => ({
    atenciones: sortBy(atenciones.filter((a) => a.pacienteId === id), '-fecha'),
    pagos: sortBy(pagos.filter((p) => p.pacienteId === id), '-fecha'),
    citas: sortBy(citas.filter((c) => c.pacienteId === id), '-inicio'),
  }), [atenciones, pagos, citas, id])
  const balance = useMemo(() => patientBalance(id, atenciones, pagos, citas), [id, atenciones, pagos, citas])

  if (!paciente) {
    return <EmptyState>El paciente no existe o fue eliminado. <Link to="/pacientes">Volver a la lista</Link></EmptyState>
  }

  const close = () => setModal(null)
  const edad = age(paciente.fechaNacimiento)
  const wa = whatsappNumber(paciente.telefono)

  const deletePatient = async () => {
    const related = mine.atenciones.length + mine.pagos.length + mine.citas.length
    const msg = related
      ? `¿Eliminar a ${fullName(paciente)} junto con ${mine.atenciones.length} atenciones, ${mine.pagos.length} pagos y ${mine.citas.length} citas? Esta acción no se puede deshacer.`
      : `¿Eliminar a ${fullName(paciente)}? Esta acción no se puede deshacer.`
    if (!window.confirm(msg)) return
    for (const c of mine.citas) await remove('citas', c.id)
    for (const p of mine.pagos) await remove('pagos', p.id)
    for (const a of mine.atenciones) await remove('atenciones', a.id)
    await remove('pacientes', paciente.id)
    navigate('/pacientes')
  }

  const now = toLimaParts(new Date()).datetime
  const nextHour = `${todayISO()}T${String(Math.min(Number(now.slice(11, 13)) + 1, 20)).padStart(2, '0')}:00`

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/pacientes" className="muted small">← Pacientes</Link>
          <h1>{fullName(paciente)}</h1>
          <p className="muted">
            {paciente.tipoDocumento} {paciente.numeroDocumento}
            {edad !== null && ` · ${edad} años`}
            {paciente.telefono && ` · ${paciente.telefono}`}
          </p>
        </div>
        <div className="actions">
          {wa && <a className="btn btn-whatsapp" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
          <button type="button" className="btn" onClick={() => setModal({ kind: 'paciente', record: paciente })}>Editar datos</button>
          <button type="button" className="btn btn-primary" onClick={() => setModal({ kind: 'cita', record: { pacienteId: id, inicio: nextHour } })}>+ Agendar cita</button>
        </div>
      </div>

      <div className="grid-2 patient-summary">
        <section className="card">
          <h2>Datos personales</h2>
          <dl className="details">
            <dt>Fecha de nacimiento</dt><dd>{paciente.fechaNacimiento ? formatDate(paciente.fechaNacimiento) : '—'}</dd>
            <dt>Correo</dt><dd>{paciente.email || '—'}</dd>
            <dt>Dirección</dt><dd>{paciente.direccion || '—'}</dd>
            <dt>Alergias / antecedentes</dt><dd className={paciente.alergias ? 'text-danger' : ''}>{paciente.alergias || '—'}</dd>
            <dt>Notas</dt><dd>{paciente.notas || '—'}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>Estado de cuenta</h2>
          <div className="stats stats-compact">
            <div className="stat"><span>Tratamientos</span><strong>{formatMoney(balance.cargos)}</strong></div>
            <div className="stat"><span>Pagado</span><strong>{formatMoney(balance.abonos)}</strong></div>
            <div className="stat"><span>Saldo</span><strong className={balance.saldo > 0 ? 'text-danger' : 'text-ok'}>{formatMoney(balance.saldo)}</strong></div>
          </div>
        </section>
      </div>

      <div className="tabs" role="tablist">
        {[
          ['historial', `Historial de atenciones (${mine.atenciones.length})`],
          ['pagos', `Pagos (${mine.pagos.length})`],
          ['citas', `Citas (${mine.citas.length})`],
        ].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'historial' && (
        <section className="card">
          <div className="card-header">
            <h2>Historial de atenciones</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setModal({ kind: 'atencion', record: { ...emptyRecord('atenciones'), pacienteId: id, fecha: todayISO() } })}>+ Registrar atención</button>
          </div>
          {mine.atenciones.length === 0 ? <p className="muted">Sin atenciones registradas.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Fecha</th><th>Tratamiento</th><th>Pieza</th><th>Diagnóstico</th><th>Doctor</th><th className="num">Costo</th></tr></thead>
                <tbody>
                  {mine.atenciones.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => setModal({ kind: 'atencion', record: a })}>
                      <td>{formatDate(a.fecha)}</td>
                      <td>{a.tratamiento}</td>
                      <td>{a.piezaDental || '—'}</td>
                      <td className="wrap">{a.diagnostico}</td>
                      <td>{fullName(byId.doctores[a.doctorId]) || '—'}</td>
                      <td className="num">{formatMoney(a.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'pagos' && (
        <section className="card">
          <div className="card-header">
            <h2>Pagos</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setModal({ kind: 'pago', record: { ...emptyRecord('pagos'), pacienteId: id, fecha: todayISO(), monto: balance.saldo > 0 ? String(balance.saldo) : '' } })}>+ Registrar pago</button>
          </div>
          {mine.pagos.length === 0 ? <p className="muted">Sin pagos registrados.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Comprobante</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {mine.pagos.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => setModal({ kind: 'pago', record: p })}>
                      <td>{formatDate(p.fecha)}</td>
                      <td>{p.concepto || byId.atenciones[p.atencionId]?.tratamiento || '—'}</td>
                      <td>{p.metodo}</td>
                      <td>{p.comprobante || '—'}</td>
                      <td className="num">{formatMoney(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'citas' && (
        <section className="card">
          <div className="card-header">
            <h2>Citas</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => setModal({ kind: 'cita', record: { pacienteId: id, inicio: nextHour } })}>+ Agendar cita</button>
          </div>
          {mine.citas.length === 0 ? <p className="muted">Sin citas.</p> : (
            <ul className="list">
              {mine.citas.map((c) => (
                <li key={c.id} className="list-row clickable" onClick={() => setModal({ kind: 'cita', record: c })}>
                  <div className="grow">
                    <strong>{formatDateTime(c.inicio, { weekday: true })}</strong>
                    <div className="muted small">{c.motivo || 'Sin motivo'}{byId.doctores[c.doctorId] ? ` · Dr(a). ${fullName(byId.doctores[c.doctorId])}` : ''}{c.costo ? ` · ${formatMoney(c.costo)}` : ''}</div>
                  </div>
                  <StateBadge estado={c.estado} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {modal?.kind === 'paciente' && (
        <Modal title="Editar paciente" onClose={close}>
          <RecordForm
            table="pacientes"
            initial={modal.record}
            onCancel={close}
            onDelete={deletePatient}
            onSubmit={async (rec) => { await update('pacientes', rec); close() }}
          />
        </Modal>
      )}
      {modal?.kind === 'atencion' && (
        <Modal title={modal.record.id ? 'Editar atención' : 'Registrar atención'} onClose={close}>
          <RecordForm
            table="atenciones"
            initial={modal.record}
            hidden={['pacienteId']}
            onCancel={close}
            onDelete={modal.record.id ? async () => {
              if (!window.confirm('¿Eliminar esta atención?')) return
              await remove('atenciones', modal.record.id)
              close()
            } : null}
            onSubmit={async (rec) => {
              if (rec.id) await update('atenciones', rec)
              else await create('atenciones', rec)
              close()
            }}
          />
        </Modal>
      )}
      {modal?.kind === 'pago' && (
        <Modal title={modal.record.id ? 'Editar pago' : 'Registrar pago'} onClose={close}>
          <RecordForm
            table="pagos"
            initial={modal.record}
            hidden={['pacienteId']}
            onCancel={close}
            onDelete={modal.record.id ? async () => {
              if (!window.confirm('¿Eliminar este pago?')) return
              await remove('pagos', modal.record.id)
              close()
            } : null}
            onSubmit={async (rec) => {
              if (rec.id) await update('pagos', rec)
              else await create('pagos', rec)
              close()
            }}
          />
        </Modal>
      )}
      {modal?.kind === 'cita' && <AppointmentModal cita={modal.record} onClose={close} />}
    </div>
  )
}
