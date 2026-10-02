import { toNumber } from './utils.js'

/** Total de atenciones, total pagado y saldo pendiente de un paciente. */
export function patientBalance(pacienteId, atenciones, pagos) {
  const cargos = atenciones.filter((a) => a.pacienteId === pacienteId).reduce((s, a) => s + toNumber(a.costo), 0)
  const abonos = pagos.filter((p) => p.pacienteId === pacienteId).reduce((s, p) => s + toNumber(p.monto), 0)
  return { cargos, abonos, saldo: round(cargos - abonos) }
}

/** Saldo de cada paciente: Map pacienteId → saldo. */
export function balancesByPatient(atenciones, pagos) {
  const map = new Map()
  for (const a of atenciones) map.set(a.pacienteId, (map.get(a.pacienteId) ?? 0) + toNumber(a.costo))
  for (const p of pagos) map.set(p.pacienteId, (map.get(p.pacienteId) ?? 0) - toNumber(p.monto))
  for (const [k, v] of map) map.set(k, round(v))
  return map
}

export function sumBy(list, key) {
  return round(list.reduce((s, r) => s + toNumber(r[key]), 0))
}

function round(n) {
  return Math.round(n * 100) / 100
}
