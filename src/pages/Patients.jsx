import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, Modal, RecordForm } from '../components/ui.jsx'
import { useData } from '../data/DataContext.jsx'
import { balancesByPatient } from '../lib/finance.js'
import { toCSV } from '../lib/importer.js'
import { columnsOf, emptyRecord, TABLES } from '../lib/schema.js'
import { age, downloadFile, formatMoney, fullName, normalize, sortBy, todayISO } from '../lib/utils.js'

export default function Patients() {
  const { pacientes, atenciones, pagos, create } = useData()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  const balances = useMemo(() => balancesByPatient(atenciones, pagos), [atenciones, pagos])
  const lastVisit = useMemo(() => {
    const m = new Map()
    for (const a of atenciones) if ((m.get(a.pacienteId) ?? '') < a.fecha) m.set(a.pacienteId, a.fecha)
    return m
  }, [atenciones])

  const list = useMemo(() => {
    const q = normalize(query)
    const all = sortBy(pacientes, 'apellidos', 'nombres')
    return q ? all.filter((p) => normalize(`${fullName(p)} ${p.apellidos} ${p.numeroDocumento} ${p.telefono} ${p.email}`).includes(q)) : all
  }, [pacientes, query])

  const exportCSV = () => {
    const cols = columnsOf('pacientes').filter((c) => !['id', 'creadoEn', 'actualizadoEn'].includes(c))
    const headers = cols.map((c) => TABLES.pacientes.fields.find((f) => f.key === c)?.label ?? c)
    downloadFile(`pacientes-${todayISO()}.csv`, toCSV(headers, list.map((p) => cols.map((c) => p[c] ?? ''))), 'text/csv;charset=utf-8')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pacientes</h1>
          <p className="muted">{pacientes.length} registrados</p>
        </div>
        <div className="actions">
          <Link to="/importar" className="btn">📥 Importar</Link>
          <button type="button" className="btn" onClick={exportCSV} disabled={!list.length}>Exportar CSV</button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>+ Nuevo paciente</button>
        </div>
      </div>

      <input className="search" type="search" placeholder="Buscar por nombre, DNI, celular o correo…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {list.length === 0 ? (
        <EmptyState>{query ? 'No se encontraron pacientes.' : 'Aún no hay pacientes. Registra uno nuevo o impórtalos desde Excel.'}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Paciente</th><th>Documento</th><th>Celular</th><th>Edad</th><th>Última atención</th><th className="num">Saldo</th></tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const saldo = balances.get(p.id) ?? 0
                return (
                  <tr key={p.id} onClick={() => navigate(`/pacientes/${p.id}`)} className="clickable">
                    <td><Link to={`/pacientes/${p.id}`} onClick={(e) => e.stopPropagation()}>{p.apellidos}, {p.nombres}</Link></td>
                    <td>{p.tipoDocumento} {p.numeroDocumento}</td>
                    <td>{p.telefono}</td>
                    <td>{age(p.fechaNacimiento) ?? '—'}</td>
                    <td>{lastVisit.get(p.id) ?? '—'}</td>
                    <td className={`num ${saldo > 0 ? 'text-danger' : ''}`}>{saldo ? formatMoney(saldo) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="Nuevo paciente" onClose={() => setCreating(false)}>
          <RecordForm
            table="pacientes"
            initial={emptyRecord('pacientes')}
            onCancel={() => setCreating(false)}
            onSubmit={async (rec) => {
              const saved = await create('pacientes', rec)
              navigate(`/pacientes/${saved.id}`)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
