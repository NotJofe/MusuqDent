// Conversión entre filas de la hoja (arreglos) y objetos JS. Sin dependencias del navegador
// para poder probarlo con Vitest.

/** Convierte un índice de columna (0 → A, 26 → AA) a letra. */
export function columnLetter(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Filas de la hoja (con encabezado en la fila 0) → objetos. Ignora filas sin id. */
export function rowsToObjects(values) {
  if (!values?.length) return []
  const header = values[0].map((h) => String(h).trim())
  const out = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    const obj = {}
    header.forEach((key, c) => {
      if (key) obj[key] = row[c] === undefined || row[c] === null ? '' : String(row[c])
    })
    if (obj.id) out.push(obj)
  }
  return out
}

/** Objeto → fila según el encabezado actual de la hoja. */
export function objectToRow(obj, header) {
  return header.map((key) => {
    const v = obj[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** Agrega al encabezado las columnas del esquema que falten, sin reordenar las existentes. */
export function mergeHeader(current, expected) {
  const header = (current ?? []).map((h) => String(h).trim())
  for (const col of expected) if (!header.includes(col)) header.push(col)
  return header
}

/** Escapa el nombre de la pestaña para usarlo en notación A1. */
export function sheetRange(sheet, range = '') {
  const quoted = `'${sheet.replace(/'/g, "''")}'`
  return range ? `${quoted}!${range}` : quoted
}
