import { toNumber } from './utils.js'

/**
 * Cargos de un paciente: el costo de cada atención, más el costo de las citas "Atendidas".
 * Si la cita está enlazada a una atención se cuenta una sola vez: el costo de la atención,
 * o el de la cita cuando la atención no tiene costo.
 */
function charges(atenciones, citas) {
  const citaCost = new Map()
  const linked = new Set(atenciones.map((a) => a.id))
  const out = []
  for (const c of citas) {
    if (c.estado !== 'Atendida' || toNumber(c.costo) <= 0) continue
    if (c.atencionId && linked.has(c.atencionId)) citaCost.set(c.atencionId, toNumber(c.costo))
    else out.push({ pacienteId: c.pacienteId, monto: toNumber(c.costo) })
  }
  for (const a of atenciones) {
    out.push({ pacienteId: a.pacienteId, monto: toNumber(a.costo) || citaCost.get(a.id) || 0 })
  }
  return out
}

/** Total de cargos, total pagado y saldo pendiente de un paciente. */
export function patientBalance(pacienteId, atenciones, pagos, citas = []) {
  const mine = (r) => r.pacienteId === pacienteId
  const cargos = charges(atenciones.filter(mine), citas.filter(mine)).reduce((s, c) => s + c.monto, 0)
  const abonos = pagos.filter(mine).reduce((s, p) => s + toNumber(p.monto), 0)
  return { cargos: round(cargos), abonos: round(abonos), saldo: round(cargos - abonos) }
}

/** Saldo de cada paciente: Map pacienteId → saldo. */
export function balancesByPatient(atenciones, pagos, citas = []) {
  const map = new Map()
  for (const c of charges(atenciones, citas)) map.set(c.pacienteId, (map.get(c.pacienteId) ?? 0) + c.monto)
  for (const p of pagos) map.set(p.pacienteId, (map.get(p.pacienteId) ?? 0) - toNumber(p.monto))
  for (const [k, v] of map) map.set(k, round(v))
  return map
}

/**
 * Lo pagado y lo pendiente de una cita. Cuenta los pagos hechos desde la cita y los
 * registrados para la atención que se creó a partir de ella.
 */
export function appointmentBalance(cita, pagos, atencion = null) {
  const costo = toNumber(cita.costo) || toNumber(atencion?.costo)
  const pagado = pagos
    .filter((p) => p.citaId === cita.id || (cita.atencionId && p.atencionId === cita.atencionId))
    .reduce((s, p) => s + toNumber(p.monto), 0)
  return { costo: round(costo), pagado: round(pagado), pendiente: round(Math.max(costo - pagado, 0)) }
}

export function sumBy(list, key) {
  return round(list.reduce((s, r) => s + toNumber(r[key]), 0))
}

function round(n) {
  return Math.round(n * 100) / 100
}
