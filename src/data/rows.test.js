import { describe, expect, it } from 'vitest'
import { columnLetter, mergeHeader, objectToRow, rowsToObjects, sheetRange } from './rows.js'

describe('rows', () => {
  it('convierte índices a letras de columna', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(25)).toBe('Z')
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(701)).toBe('ZZ')
  })
  it('lee filas usando el encabezado e ignora filas sin id', () => {
    const values = [['id', 'nombres', 'extra'], ['p1', 'Ana'], [], ['', 'sin id'], ['p2', 'Luis', 'x']]
    expect(rowsToObjects(values)).toEqual([
      { id: 'p1', nombres: 'Ana', extra: '' },
      { id: 'p2', nombres: 'Luis', extra: 'x' },
    ])
  })
  it('respeta columnas agregadas por el usuario', () => {
    const header = mergeHeader(['id', 'mi columna', 'nombres'], ['id', 'nombres', 'apellidos'])
    expect(header).toEqual(['id', 'mi columna', 'nombres', 'apellidos'])
    expect(objectToRow({ id: 'p1', nombres: 'Ana', 'mi columna': 'ok' }, header)).toEqual(['p1', 'ok', 'Ana', ''])
  })
  it('escapa nombres de pestañas', () => {
    expect(sheetRange("Citas d'hoy", 'A1')).toBe("'Citas d''hoy'!A1")
  })
})
