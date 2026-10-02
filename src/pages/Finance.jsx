import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BarChart from '../components/BarChart.jsx'
import { useData } from '../data/DataContext.jsx'
import { filterPayments, GROUPINGS, groupPayments, NO_DOCTOR, paymentRows, periodRange, summarize } from '../lib/report.js'
import { PAYMENT_METHODS } from '../lib/schema.js'
import { formatDate, formatMoney, fullName, sortBy, todayISO } from '../lib/utils.js'

const PREFS_KEY = 'musuqdent.finanzas'

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function Finance() {
  const data = useData()
  const today = todayISO()
  const [filters, setFilters] = useState(() => ({
    mode: 'mes',
    month: today.slice(0, 7),
    from: `${today.slice(0, 7)}-01`,
    to: today,
    doctorId: '',
    metodo: '',
    groupBy: loadPrefs().groupBy || 'dia',
  }))
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }))
    if (patch.groupBy) {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify({ groupBy: patch.groupBy })) } catch { /* sin almacenamiento */ }
    }
  }

  const range = periodRange(filters)
  const allRows = useMemo(() => paymentRows(data), [data])
  const rows = useMemo(
    () => filterPayments(allRows, { ...range, doctorId: filters.doctorId, metodo: filters.metodo })
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [allRows, range.from, range.to, filters.doctorId, filters.metodo], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const stats = summarize(rows)
  const groups = useMemo(() => groupPayments(rows, filters.groupBy, range), [rows, filters.groupBy, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const isTime = GROUPINGS[filters.groupBy].time
  const methods = [...new Set([...PAYMENT_METHODS, ...allRows.map((r) => r.metodo)])]

  const periodText = filters.mode === 'mes'
    ? new Date(`${filters.month}-15T12:00:00Z`).toLocaleDateString('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : `${range.from ? formatDate(range.from) : 'el inicio'} – ${range.to ? formatDate(range.to) : 'hoy'}`
  const filterText = [
    filters.doctorId ? (filters.doctorId === NO_DOCTOR ? 'Sin doctor' : `Dr(a). ${fullName(data.byId.doctores[filters.doctorId])}`) : 'Todos los doctores',
    filters.metodo || 'Todos los métodos',
  ].join(' · ')

  const exportExcel = async () => {
    setExporting(true)
    setError('')
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser')
      const bold = { fontWeight: 'bold' }
      const money = '#,##0.00'
      const groupLabel = GROUPINGS[filters.groupBy].label
      const resumen = [
        [{ value: 'MusuqDent – Reporte de ingresos', fontWeight: 'bold', fontSize: 14 }],
        [{ value: 'Periodo', ...bold }, { value: periodText }],
        [{ value: 'Filtros', ...bold }, { value: filterText }],
        [{ value: 'Total ingresos (S/)', ...bold }, { value: stats.total, type: Number, format: money }],
        [{ value: 'N° de pagos', ...bold }, { value: stats.count, type: Number }],
        [{ value: 'Promedio por pago (S/)', ...bold }, { value: stats.promedio, type: Number, format: money }],
        [],
        [groupLabel, 'Total (S/)', 'N° pagos', '% del total'].map((v) => ({ value: v, ...bold, backgroundColor: '#ccfbf1' })),
        ...groups.map((g) => [
          { value: g.label },
          { value: g.total, type: Number, format: money },
          { value: g.count, type: Number },
          { value: g.porcentaje / 100, type: Number, format: '0.0%' },
        ]),
      ]
      const header = ['Fecha', 'Paciente', 'Documento', 'Doctor', 'Concepto', 'Método', 'Comprobante', 'Monto (S/)']
      const detalle = [
        header.map((v) => ({ value: v, ...bold, backgroundColor: '#ccfbf1' })),
        ...rows.map((r) => [
          { value: r.fecha ? new Date(`${r.fecha}T00:00:00Z`) : '', type: Date, format: 'dd/mm/yyyy' },
          { value: r.paciente },
          { value: r.documento },
          { value: r.doctor },
          { value: r.concepto },
          { value: r.metodo },
          { value: r.comprobante },
          { value: r.monto, type: Number, format: money },
        ]),
        [
          ...Array(6).fill(null),
          { value: 'TOTAL', ...bold },
          { value: stats.total, type: Number, format: money, ...bold },
        ],
      ]
      const name = filters.mode === 'mes' ? filters.month : `${range.from || 'inicio'}_${range.to || today}`
      await writeXlsxFile([
        { sheet: 'Resumen', data: resumen, columns: [{ width: 28 }, { width: 22 }, { width: 10 }, { width: 12 }] },
        { sheet: 'Pagos', data: detalle, columns: [{ width: 12 }, { width: 28 }, { width: 12 }, { width: 24 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 13 }] },
      ]).toFile(`musuqdent-ingresos-${name}.xlsx`)
    } catch (e) {
      setError(`No se pudo generar el Excel: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Finanzas</h1>
          <p className="muted">Ingresos registrados como pagos · <span className="capitalize">{periodText}</span></p>
        </div>
        <button type="button" className="btn btn-primary" onClick={exportExcel} disabled={exporting || !rows.length}>
          {exporting ? 'Generando…' : '⬇ Exportar a Excel'}
        </button>
      </div>

      <section className="card filters">
        <div className="segmented" role="group" aria-label="Tipo de periodo">
          <button type="button" className={filters.mode === 'mes' ? 'active' : ''} onClick={() => set({ mode: 'mes' })}>Mes</button>
          <button type="button" className={filters.mode === 'rango' ? 'active' : ''} onClick={() => set({ mode: 'rango' })}>Rango de fechas</button>
        </div>
        {filters.mode === 'mes' ? (
          <label>
            <span>Mes</span>
            <input type="month" value={filters.month} onChange={(e) => e.target.value && set({ month: e.target.value })} />
          </label>
        ) : (
          <>
            <label><span>Desde</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} /></label>
            <label><span>Hasta</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} /></label>
          </>
        )}
        <label>
          <span>Doctor</span>
          <select value={filters.doctorId} onChange={(e) => set({ doctorId: e.target.value })}>
            <option value="">Todos</option>
            {sortBy(data.doctores, 'apellidos').map((d) => <option key={d.id} value={d.id}>{fullName(d)}</option>)}
            <option value={NO_DOCTOR}>Sin doctor asignado</option>
          </select>
        </label>
        <label>
          <span>Método de pago</span>
          <select value={filters.metodo} onChange={(e) => set({ metodo: e.target.value })}>
            <option value="">Todos</option>
            {methods.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      </section>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="stats">
        <div className="stat"><span>Total de ingresos</span><strong>{formatMoney(stats.total)}</strong></div>
        <div className="stat"><span>N° de pagos</span><strong>{stats.count}</strong></div>
        <div className="stat"><span>Promedio por pago</span><strong>{formatMoney(stats.promedio)}</strong></div>
        <div className="stat"><span>Pacientes que pagaron</span><strong>{stats.pacientes}</strong></div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Ingresos por {GROUPINGS[filters.groupBy].label.toLowerCase()} (S/)</h2>
          <label className="inline-label">
            <span>Agrupar por</span>
            <select value={filters.groupBy} onChange={(e) => set({ groupBy: e.target.value })}>
              {Object.entries(GROUPINGS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
            </select>
          </label>
        </div>
        <BarChart
          data={rows.length ? groups : []}
          horizontal={!isTime}
          formatValue={formatMoney}
          ariaLabel={`Ingresos por ${GROUPINGS[filters.groupBy].label}`}
        />
        {rows.length > 0 && (
          <div className="table-wrap group-table">
            <table className="table">
              <thead>
                <tr><th>{GROUPINGS[filters.groupBy].label}</th><th className="num">N° pagos</th><th className="num">% del total</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {groups.filter((g) => !isTime || g.count > 0).map((g) => (
                  <tr key={g.key}>
                    <td>{g.label}</td>
                    <td className="num">{g.count}</td>
                    <td className="num">{g.porcentaje.toFixed(1)}%</td>
                    <td className="num">{formatMoney(g.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th>Total</th><th className="num">{stats.count}</th><th className="num">100%</th><th className="num">{formatMoney(stats.total)}</th></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Detalle de pagos ({rows.length})</h2>
        </div>
        {rows.length === 0 ? <p className="muted">No hay pagos con los filtros seleccionados.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Paciente</th><th>Doctor</th><th>Concepto</th><th>Método</th><th className="num">Monto</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.fecha)}</td>
                    <td>{data.byId.pacientes[r.pacienteId] ? <Link to={`/pacientes/${r.pacienteId}`}>{r.paciente}</Link> : r.paciente}</td>
                    <td>{r.doctor}</td>
                    <td>{r.concepto}</td>
                    <td>{r.metodo}</td>
                    <td className="num">{formatMoney(r.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
