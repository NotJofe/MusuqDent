import { describe, expect, it } from 'vitest'
import { appointmentBalance, balancesByPatient, patientBalance } from './finance.js'

const atenciones = [{ id: 'a1', pacienteId: 'p1', costo: '150' }]
const citas = [
  // Atendida con atención registrada: el costo ya está en la atención
  { id: 'c1', pacienteId: 'p1', estado: 'Atendida', costo: '150', atencionId: 'a1' },
  // Atendida sin atención: su costo cuenta como cargo
  { id: 'c2', pacienteId: 'p1', estado: 'Atendida', costo: '80', atencionId: '' },
  // Programada: aún no genera cargo
  { id: 'c3', pacienteId: 'p1', estado: 'Programada', costo: '60', atencionId: '' },
]
const pagos = [
  { id: 'g1', pacienteId: 'p1', citaId: 'c2', monto: '50' },
  { id: 'g2', pacienteId: 'p1', atencionId: 'a1', citaId: '', monto: '100' },
]

describe('finance', () => {
  it('suma atenciones y citas atendidas sin contar dos veces', () => {
    expect(patientBalance('p1', atenciones, pagos, citas)).toEqual({ cargos: 230, abonos: 150, saldo: 80 })
    expect(balancesByPatient(atenciones, pagos, citas).get('p1')).toBe(80)
  })
  it('calcula lo pendiente de una cita', () => {
    expect(appointmentBalance(citas[1], pagos)).toEqual({ costo: 80, pagado: 50, pendiente: 30 })
    // pagos de la atención enlazada también cuentan
    expect(appointmentBalance(citas[0], pagos, atenciones[0])).toEqual({ costo: 150, pagado: 100, pendiente: 50 })
  })
  it('usa el costo de la cita si la atención enlazada no tiene costo', () => {
    const sinCosto = [{ id: 'a1', pacienteId: 'p1', costo: '' }]
    expect(patientBalance('p1', sinCosto, [], [citas[0]]).cargos).toBe(150)
  })
  it('usa el costo de la atención si la cita no tiene costo', () => {
    expect(appointmentBalance({ ...citas[0], costo: '' }, [], atenciones[0]).costo).toBe(150)
  })
})
