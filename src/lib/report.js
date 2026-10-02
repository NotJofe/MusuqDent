// Lógica del módulo Finanzas: une cada pago con su paciente, doctor y tratamiento,
// filtra por periodo/doctor/método y agrupa para el gráfico y la exportación.
import { fullName, pad, toNumber } from './utils.js'

export const NO_DOCTOR = '__sin_doctor'

export const GROUPINGS = {
  dia: { label: 'Día', time: true },
  semana: { label: 'Semana', time: true },
  mes: { label: 'Mes', time: true },
  doctor: { label: 'Doctor' },
  metodo: { label: 'Método de pago' },
  concepto: { label: 'Concepto / tratamiento' },
  paciente: { label: 'Paciente' },
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

/** Pagos con los datos relacionados ya resueltos. */
export function paymentRows({ pagos, byId }) {
  return pagos.map((p) => {
    const cita = byId.citas[p.citaId]
    const atencion = byId.atenciones[p.atencionId] ?? byId.atenciones[cita?.atencionId]
    const doctorId = cita?.doctorId || atencion?.doctorId || ''
    const paciente = byId.pacientes[p.pacienteId]
    const doctor = byId.doctores[doctorId]
    return {
      id: p.id,
      fecha: String(p.fecha ?? '').slice(0, 10),
      monto: toNumber(p.monto),
      metodo: p.metodo || 'Otro',
      concepto: p.concepto || atencion?.tratamiento || cita?.motivo || 'Sin concepto',
      comprobante: p.comprobante ?? '',
      pacienteId: p.pacienteId,
      paciente: paciente ? fullName(paciente) : 'Paciente eliminado',
      documento: paciente?.numeroDocumento ?? '',
      doctorId: doctor ? doctorId : NO_DOCTOR,
      doctor: doctor ? fullName(doctor) : 'Sin doctor',
    }
  })
}

/** Fechas desde/hasta (inclusive) según el modo del filtro de periodo. */
export function periodRange({ mode, month, from, to }) {
  if (mode === 'mes' && /^\d{4}-\d{2}$/.test(month ?? '')) {
    const [y, m] = month.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { from: `${month}-01`, to: `${month}-${pad(last)}` }
  }
  return { from: from || '', to: to || '' }
}

export function filterPayments(rows, { from, to, doctorId, metodo }) {
  return rows.filter((r) => (!from || r.fecha >= from)
    && (!to || r.fecha <= to)
    && (!doctorId || r.doctorId === doctorId)
    && (!metodo || r.metodo === metodo))
}

export function summarize(rows) {
  const total = round(rows.reduce((s, r) => s + r.monto, 0))
  return {
    total,
    count: rows.length,
    promedio: rows.length ? round(total / rows.length) : 0,
    pacientes: new Set(rows.map((r) => r.pacienteId)).size,
  }
}

function parseISO(iso) {
  return new Date(`${iso}T00:00:00Z`)
}

function isoOf(date) {
  return date.toISOString().slice(0, 10)
}

/** Lunes de la semana de una fecha 'YYYY-MM-DD'. */
export function weekStart(iso) {
  const d = parseISO(iso)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return isoOf(d)
}

function timeKey(by, fecha) {
  if (by === 'dia') return fecha
  if (by === 'semana') return weekStart(fecha)
  return fecha.slice(0, 7)
}

function timeLabel(by, key) {
  const [y, m, d] = key.split('-')
  if (by === 'mes') return `${MONTHS[Number(m) - 1]} ${y}`
  if (by === 'semana') return `Sem. ${d} ${MONTHS[Number(m) - 1]}`
  return `${d} ${MONTHS[Number(m) - 1]}`
}

function nextKey(by, key) {
  if (by === 'mes') {
    const [y, m] = key.split('-').map(Number)
    return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`
  }
  const d = parseISO(key)
  d.setUTCDate(d.getUTCDate() + (by === 'semana' ? 7 : 1))
  return isoOf(d)
}

/**
 * Agrupa los pagos. Las agrupaciones por tiempo van en orden cronológico e incluyen los
 * periodos sin ingresos (con 0) para no ocultar huecos; las demás, de mayor a menor.
 * Devuelve [{ key, label, total, count, porcentaje }].
 */
export function groupPayments(rows, by, { from, to } = {}) {
  const groups = new Map()
  const add = (key, label, monto) => {
    const g = groups.get(key) ?? { key, label, total: 0, count: 0 }
    g.total += monto
    g.count += 1
    groups.set(key, g)
  }

  if (GROUPINGS[by]?.time) {
    for (const r of rows) if (r.fecha) add(timeKey(by, r.fecha), timeLabel(by, timeKey(by, r.fecha)), r.monto)
    const keys = [...groups.keys()].sort()
    const start = from ? timeKey(by, from) : keys[0]
    const end = to ? timeKey(by, to) : keys[keys.length - 1]
    if (start && end) {
      // Completa los periodos vacíos (con un tope para rangos muy largos)
      for (let k = start, n = 0; k <= end && n < 400; k = nextKey(by, k), n++) {
        if (!groups.has(k)) groups.set(k, { key: k, label: timeLabel(by, k), total: 0, count: 0 })
      }
    }
  } else {
    const field = { doctor: ['doctorId', 'doctor'], metodo: ['metodo', 'metodo'], concepto: ['concepto', 'concepto'], paciente: ['pacienteId', 'paciente'] }[by]
    for (const r of rows) add(r[field[0]], r[field[1]], r.monto)
  }

  const total = rows.reduce((s, r) => s + r.monto, 0)
  const list = [...groups.values()].map((g) => ({
    ...g,
    total: round(g.total),
    porcentaje: total ? round((g.total / total) * 100) : 0,
  }))
  return GROUPINGS[by]?.time
    ? list.sort((a, b) => a.key.localeCompare(b.key))
    : list.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
}

function round(n) {
  return Math.round(n * 100) / 100
}
