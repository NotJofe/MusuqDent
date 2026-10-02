import { describe, expect, it } from 'vitest'
import { filterPayments, groupPayments, NO_DOCTOR, paymentRows, periodRange, summarize, weekStart } from './report.js'

const byId = {
  pacientes: { p1: { id: 'p1', nombres: 'Ana', apellidos: 'Paz', numeroDocumento: '12345678' }, p2: { id: 'p2', nombres: 'Luis', apellidos: 'Soto' } },
  doctores: { d1: { id: 'd1', nombres: 'Lucía', apellidos: 'Quispe' } },
  citas: { c1: { id: 'c1', doctorId: 'd1', motivo: 'Limpieza', atencionId: '' } },
  atenciones: { a1: { id: 'a1', doctorId: 'd1', tratamiento: 'Resina' } },
}
const pagos = [
  { id: 'g1', pacienteId: 'p1', citaId: 'c1', fecha: '2026-10-01', monto: '80', metodo: 'Yape', concepto: '' },
  { id: 'g2', pacienteId: 'p1', atencionId: 'a1', fecha: '2026-10-03', monto: '150', metodo: 'Efectivo', concepto: '' },
  { id: 'g3', pacienteId: 'p2', fecha: '2026-10-03', monto: '50.5', metodo: 'Yape', concepto: 'Adelanto' },
  { id: 'g4', pacienteId: 'p2', fecha: '2026-09-15', monto: '20', metodo: 'Plin', concepto: 'Otro' },
]
const rows = paymentRows({ pagos, byId })

describe('paymentRows', () => {
  it('obtiene el doctor y el concepto desde la cita o la atención', () => {
    expect(rows[0]).toMatchObject({ doctorId: 'd1', doctor: 'Lucía Quispe', concepto: 'Limpieza', monto: 80, paciente: 'Ana Paz' })
    expect(rows[1]).toMatchObject({ doctorId: 'd1', concepto: 'Resina' })
    expect(rows[2]).toMatchObject({ doctorId: NO_DOCTOR, doctor: 'Sin doctor', concepto: 'Adelanto' })
  })
})

describe('filtros', () => {
  it('calcula el rango de un mes', () => {
    expect(periodRange({ mode: 'mes', month: '2026-02' })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange({ mode: 'rango', from: '2026-10-01', to: '' })).toEqual({ from: '2026-10-01', to: '' })
  })
  it('filtra por periodo, doctor y método', () => {
    const oct = periodRange({ mode: 'mes', month: '2026-10' })
    expect(filterPayments(rows, oct).map((r) => r.id)).toEqual(['g1', 'g2', 'g3'])
    expect(filterPayments(rows, { ...oct, metodo: 'Yape' }).map((r) => r.id)).toEqual(['g1', 'g3'])
    expect(filterPayments(rows, { ...oct, doctorId: NO_DOCTOR }).map((r) => r.id)).toEqual(['g3'])
  })
  it('resume el total', () => {
    expect(summarize(filterPayments(rows, periodRange({ mode: 'mes', month: '2026-10' }))))
      .toEqual({ total: 280.5, count: 3, promedio: 93.5, pacientes: 2 })
  })
})

describe('groupPayments', () => {
  it('agrupa por día completando los días sin ingresos', () => {
    const g = groupPayments(filterPayments(rows, { from: '2026-10-01', to: '2026-10-04' }), 'dia', { from: '2026-10-01', to: '2026-10-04' })
    expect(g.map((x) => [x.key, x.total])).toEqual([['2026-10-01', 80], ['2026-10-02', 0], ['2026-10-03', 200.5], ['2026-10-04', 0]])
  })
  it('agrupa por semana (lunes) y por mes', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28')
    expect(groupPayments(rows, 'mes').map((x) => [x.label, x.total])).toEqual([['Set 2026', 20], ['Oct 2026', 280.5]])
  })
  it('agrupa por método de mayor a menor con porcentaje', () => {
    const g = groupPayments(rows, 'metodo')
    expect(g[0]).toMatchObject({ label: 'Efectivo', total: 150, count: 1 })
    expect(g.map((x) => x.label)).toEqual(['Efectivo', 'Yape', 'Plin'])
    expect(g.reduce((s, x) => s + x.porcentaje, 0)).toBeCloseTo(100, 0)
  })
})
