import { describe, expect, it } from 'vitest'
import { autoMap, buildRecords, matrixToTable } from './importer.js'

describe('autoMap', () => {
  it('reconoce encabezados típicos de Excel', () => {
    const headers = ['Nombres', 'Apellidos', 'DNI', 'Celular', 'Fecha de Nacimiento', 'Correo electrónico']
    expect(autoMap(headers, 'pacientes')).toMatchObject({
      nombres: 0, apellidos: 1, numeroDocumento: 2, telefono: 3, fechaNacimiento: 4, email: 5,
    })
  })
  it('detecta una columna de nombre completo', () => {
    const map = autoMap(['Paciente', 'DNI'], 'pacientes')
    expect(map._nombreCompleto).toBe(0)
  })
})

describe('buildRecords', () => {
  it('importa pacientes, corrige DNI sin cero inicial y omite duplicados', () => {
    const { headers, rows } = matrixToTable([
      ['Nombres', 'Apellidos', 'DNI', 'Celular', 'Nacimiento'],
      ['Ana', 'Paz', 1234567, '987 654 321', '01/02/1990'],
      ['Luis', 'Soto', '87654321', '912345678', ''],
      ['Repetido', 'X', '87654321', '912345678', ''],
      ['', 'Sin nombre', '11111111', '900000000', ''],
      ['Existe', 'Ya', '22222222', '900000001', ''],
    ])
    const mapping = autoMap(headers, 'pacientes')
    const existing = { pacientes: [{ id: 'p0', numeroDocumento: '22222222' }] }
    const { records, skipped } = buildRecords('pacientes', rows, mapping, { existing })
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ nombres: 'Ana', numeroDocumento: '01234567', telefono: '987654321', fechaNacimiento: '1990-02-01', tipoDocumento: 'DNI' })
    expect(skipped.map((s) => s.fila)).toEqual([4, 5, 6])
  })

  it('separa el nombre completo en nombres y apellidos', () => {
    const { headers, rows } = matrixToTable([['Paciente', 'DNI', 'Celular'], ['María Elena Condori Flores', '45678912', '912345678']])
    const { records } = buildRecords('pacientes', rows, autoMap(headers, 'pacientes'))
    expect(records[0]).toMatchObject({ nombres: 'María Elena', apellidos: 'Condori Flores' })
  })

  it('enlaza atenciones con el paciente por DNI y el doctor por nombre', () => {
    const existing = {
      pacientes: [{ id: 'p1', numeroDocumento: '45678912' }],
      doctores: [{ id: 'd1', nombres: 'Lucía', apellidos: 'Quispe Mamani' }],
    }
    const { headers, rows } = matrixToTable([
      ['DNI', 'Doctor', 'Fecha', 'Tratamiento', 'Costo'],
      ['45678912', 'Dra. Lucía Quispe', '02/10/2026', 'Profilaxis', 'S/ 80'],
      ['99999999', 'Lucía', '02/10/2026', 'Resina', '150'],
    ])
    const { records, skipped } = buildRecords('atenciones', rows, autoMap(headers, 'atenciones'), { existing })
    expect(records).toEqual([expect.objectContaining({ pacienteId: 'p1', doctorId: 'd1', fecha: '2026-10-02', costo: '80' })])
    expect(skipped[0].motivo).toMatch(/99999999/)
  })
})
