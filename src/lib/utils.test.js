import { describe, expect, it } from 'vitest'
import { addMinutes, age, limaToDate, parseDate, toLimaParts, toNumber, validateRecord, whatsappNumber } from './utils.js'

describe('parseDate', () => {
  it('acepta formatos comunes en Perú', () => {
    expect(parseDate('14/03/1990')).toBe('1990-03-14')
    expect(parseDate('1990-03-14')).toBe('1990-03-14')
    expect(parseDate('5-1-95')).toBe('1995-01-05')
    expect(parseDate(new Date(Date.UTC(2001, 10, 2)))).toBe('2001-11-02')
  })
  it('convierte seriales de Excel', () => {
    expect(parseDate(32946)).toBe('1990-03-14')
  })
  it('rechaza fechas inválidas', () => {
    expect(parseDate('31/02/2020')).toBe('')
    expect(parseDate('hola')).toBe('')
    expect(parseDate('')).toBe('')
  })
})

describe('hora de Lima', () => {
  it('convierte entre Date y hora local de Lima (UTC-5)', () => {
    expect(toLimaParts(new Date('2026-10-02T03:30:00Z')).datetime).toBe('2026-10-01T22:30')
    expect(limaToDate('2026-10-01T22:30').toISOString()).toBe('2026-10-02T03:30:00.000Z')
    expect(addMinutes('2026-10-01T23:45', 30)).toBe('2026-10-02T00:15')
  })
  it('calcula la edad', () => {
    const now = new Date('2026-10-02T15:00:00Z')
    expect(age('1990-10-02', now)).toBe(36)
    expect(age('1990-10-03', now)).toBe(35)
    expect(age('', now)).toBeNull()
  })
})

describe('toNumber', () => {
  it('entiende montos escritos de distintas formas', () => {
    expect(toNumber('S/ 1,250.50')).toBe(1250.5)
    expect(toNumber('1.250,50')).toBe(1250.5)
    expect(toNumber('80,5')).toBe(80.5)
    expect(toNumber('')).toBe(0)
  })
})

describe('whatsappNumber', () => {
  it('agrega el código de Perú a celulares de 9 dígitos', () => {
    expect(whatsappNumber('987 654 321')).toBe('51987654321')
    expect(whatsappNumber('+51 987654321')).toBe('51987654321')
    expect(whatsappNumber('')).toBe('')
  })
})

describe('validateRecord', () => {
  const base = { nombres: 'Ana', apellidos: 'Paz', tipoDocumento: 'DNI', numeroDocumento: '12345678', telefono: '987654321' }
  it('valida campos obligatorios y DNI', () => {
    expect(validateRecord('pacientes', base)).toEqual({})
    expect(validateRecord('pacientes', { ...base, nombres: '' }).nombres).toBeTruthy()
    expect(validateRecord('pacientes', { ...base, numeroDocumento: '123' }).numeroDocumento).toMatch(/8 dígitos/)
  })
  it('detecta documentos duplicados', () => {
    const errors = validateRecord('pacientes', base, [{ ...base, id: 'otro' }])
    expect(errors.numeroDocumento).toMatch(/Ya existe/)
    expect(validateRecord('pacientes', { ...base, id: 'x' }, [{ ...base, id: 'x' }])).toEqual({})
  })
  it('exige que la cita termine después de empezar', () => {
    const cita = { pacienteId: 'p1', inicio: '2026-10-02T10:00', fin: '2026-10-02T09:00' }
    expect(validateRecord('citas', cita).fin).toBeTruthy()
  })
})
