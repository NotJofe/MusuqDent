import Papa from 'papaparse'
import { TABLES } from './schema.js'
import { cleanPhone, fullName, normalize, parseDate, toNumber } from './utils.js'

// Tablas que se pueden importar desde Excel/CSV y campos extra para enlazar registros.
export const IMPORT_TARGETS = {
  pacientes: { label: 'Pacientes', extra: [] },
  doctores: { label: 'Doctores', extra: [] },
  atenciones: {
    label: 'Atenciones (historial)',
    extra: [
      { key: '_pacienteDoc', label: 'DNI del paciente', required: true },
      { key: '_doctorNombre', label: 'Nombre del doctor' },
    ],
  },
  pagos: {
    label: 'Pagos',
    extra: [{ key: '_pacienteDoc', label: 'DNI del paciente', required: true }],
  },
}

// Encabezados frecuentes en hojas de Excel peruanas → campo de MusuqDent.
const ALIASES = {
  nombres: ['nombre', 'nombres', 'primer nombre', 'name', 'first name'],
  apellidos: ['apellido', 'apellidos', 'apellido paterno', 'last name', 'surname'],
  tipoDocumento: ['tipo documento', 'tipo de documento', 'tipo doc', 'tipo'],
  numeroDocumento: ['dni', 'documento', 'nro documento', 'n documento', 'numero documento', 'numero de documento', 'doc', 'nro doc', 'id', 'id number', 'documento de identidad'],
  fechaNacimiento: ['fecha nacimiento', 'fecha de nacimiento', 'nacimiento', 'cumpleanos', 'f nacimiento', 'birthday', 'birth date', 'fec nac'],
  telefono: ['telefono', 'celular', 'movil', 'cel', 'tel', 'whatsapp', 'phone', 'numero', 'nro celular', 'telefono celular'],
  email: ['email', 'correo', 'correo electronico', 'e mail', 'mail'],
  direccion: ['direccion', 'domicilio', 'address'],
  alergias: ['alergias', 'antecedentes', 'alergia'],
  notas: ['notas', 'observaciones', 'obs', 'comentarios', 'nota'],
  especialidad: ['especialidad', 'specialty'],
  cop: ['cop', 'colegiatura', 'nro cop', 'n cop'],
  color: ['color'],
  activo: ['activo', 'estado'],
  fecha: ['fecha', 'fecha atencion', 'fecha de atencion', 'fecha pago', 'fecha de pago', 'date'],
  tratamiento: ['tratamiento', 'procedimiento', 'servicio'],
  piezaDental: ['pieza', 'pieza dental', 'diente', 'piezas'],
  diagnostico: ['diagnostico', 'dx'],
  costo: ['costo', 'precio', 'importe', 'total'],
  monto: ['monto', 'pago', 'importe', 'pagado', 'abono', 'amount'],
  metodo: ['metodo', 'metodo de pago', 'forma de pago', 'medio de pago', 'medio'],
  concepto: ['concepto', 'descripcion', 'detalle'],
  comprobante: ['comprobante', 'boleta', 'factura', 'recibo', 'nro comprobante'],
  _pacienteDoc: ['dni', 'dni paciente', 'dni del paciente', 'documento paciente', 'documento', 'nro documento', 'paciente dni'],
  _doctorNombre: ['doctor', 'doctora', 'odontologo', 'odontologa', 'medico', 'especialista', 'dr'],
}

/** Campos que se pueden mapear al importar en la tabla indicada (sin campos de referencia). */
export function importFields(table) {
  const fields = TABLES[table].fields.filter((f) => f.type !== 'ref')
  return [...IMPORT_TARGETS[table].extra, ...fields]
}

function decodeText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '')
  } catch {
    // Excel en Windows suele guardar CSV en Windows-1252 (tildes y ñ)
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/** Lee un archivo .csv o .xlsx y devuelve { headers, rows } (rows = arreglo de arreglos). */
export async function parseFile(file) {
  const name = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()
  let matrix
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/universal')
    matrix = await readSheet(buffer)
  } else if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const result = Papa.parse(decodeText(buffer), { skipEmptyLines: 'greedy' })
    matrix = result.data
  } else {
    throw new Error('Formato no soportado. Usa un archivo .xlsx o .csv (en Excel: "Guardar como" → .xlsx o CSV).')
  }
  return matrixToTable(matrix)
}

export function matrixToTable(matrix) {
  const rows = (matrix ?? []).filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
  if (!rows.length) throw new Error('El archivo está vacío.')
  const headers = rows[0].map((h, i) => String(h ?? '').trim() || `Columna ${i + 1}`)
  return { headers, rows: rows.slice(1) }
}

/** Propone qué columna del archivo corresponde a cada campo. Devuelve { campo: índiceColumna }. */
export function autoMap(headers, table) {
  const mapping = {}
  const used = new Set()
  const norm = headers.map(normalize)
  for (const f of importFields(table)) {
    const candidates = [normalize(f.key), normalize(f.label), ...(ALIASES[f.key] ?? []).map(normalize)]
    const idx = norm.findIndex((h, i) => !used.has(i) && candidates.includes(h))
    if (idx >= 0) {
      mapping[f.key] = idx
      used.add(idx)
    }
  }
  // Si el archivo trae "Nombre completo" o "Paciente" en una sola columna
  if (table === 'pacientes' && mapping.nombres === undefined) {
    const idx = norm.findIndex((h, i) => !used.has(i) && ['nombre completo', 'paciente', 'nombres y apellidos', 'apellidos y nombres'].includes(h))
    if (idx >= 0) mapping._nombreCompleto = idx
  }
  return mapping
}

function cell(row, idx) {
  if (idx === undefined || idx === null || idx === '') return ''
  const v = row[Number(idx)]
  if (v instanceof Date) return v
  return v === undefined || v === null ? '' : typeof v === 'number' ? v : String(v).trim()
}

function matchOption(value, options) {
  const n = normalize(value)
  return options.find((o) => normalize(o) === n) ?? options.find((o) => normalize(o).startsWith(n) && n) ?? ''
}

/**
 * Convierte las filas del archivo en registros listos para guardar.
 * Devuelve { records, skipped: [{ fila, motivo }] }.
 */
export function buildRecords(table, rows, mapping, { existing = {} } = {}) {
  const fields = TABLES[table].fields
  const records = []
  const skipped = []
  const pacientesPorDoc = new Map((existing.pacientes ?? []).map((p) => [normalize(p.numeroDocumento), p]))
  const seenDocs = new Set(table === 'pacientes' ? pacientesPorDoc.keys() : [])

  rows.forEach((row, i) => {
    const fila = i + 2 // +1 por el encabezado, +1 porque las filas empiezan en 1
    const rec = {}
    for (const f of fields) {
      if (f.type === 'ref') continue
      let v = cell(row, mapping[f.key])
      if (f.type === 'date') v = parseDate(v)
      else if (f.type === 'number') v = v === '' ? '' : String(toNumber(v))
      else if (f.type === 'tel') v = cleanPhone(v)
      else if (f.type === 'select') v = (v !== '' && matchOption(v, f.options)) || f.default || ''
      else v = v instanceof Date ? parseDate(v) : String(v)
      if (v === '' && f.default) v = f.default
      rec[f.key] = v
    }

    if (mapping._nombreCompleto !== undefined && !rec.nombres) {
      const parts = String(cell(row, mapping._nombreCompleto)).split(/\s+/).filter(Boolean)
      // En Perú se suele escribir "Nombres Apellido1 Apellido2"
      rec.apellidos = parts.length > 2 ? parts.slice(-2).join(' ') : parts.slice(1).join(' ')
      rec.nombres = parts.slice(0, parts.length > 2 ? -2 : 1).join(' ')
    }

    if (table === 'pacientes' && rec.numeroDocumento) {
      rec.numeroDocumento = String(rec.numeroDocumento).replace(/\s/g, '')
      // Excel suele quitar el cero inicial a los DNI
      if (rec.tipoDocumento === 'DNI' && /^\d{7}$/.test(rec.numeroDocumento)) rec.numeroDocumento = `0${rec.numeroDocumento}`
    }

    if (table === 'atenciones' || table === 'pagos') {
      let doc = String(cell(row, mapping._pacienteDoc)).replace(/\s/g, '')
      if (/^\d{7}$/.test(doc)) doc = `0${doc}`
      const paciente = pacientesPorDoc.get(normalize(doc))
      if (!paciente) {
        skipped.push({ fila, motivo: doc ? `No existe un paciente con documento ${doc}` : 'Falta el DNI del paciente' })
        return
      }
      rec.pacienteId = paciente.id
      if (table === 'pagos') rec.atencionId = ''
    }
    if (table === 'atenciones') {
      const nombre = normalize(cell(row, mapping._doctorNombre)).replace(/^(dra?|doctora?)\s+/, '')
      const doctor = nombre
        ? (existing.doctores ?? []).find((d) => {
          const full = normalize(fullName(d))
          return full === nombre || full.includes(nombre) || normalize(d.apellidos).startsWith(nombre)
        })
        : null
      rec.doctorId = doctor?.id ?? ''
    }

    const missing = fields.filter((f) => f.required && f.type !== 'ref' && !String(rec[f.key] ?? '').trim())
    if (missing.length) {
      skipped.push({ fila, motivo: `Falta: ${missing.map((f) => f.label).join(', ')}` })
      return
    }
    if (table === 'pacientes') {
      const key = normalize(rec.numeroDocumento)
      if (seenDocs.has(key)) {
        skipped.push({ fila, motivo: `Documento ${rec.numeroDocumento} ya registrado` })
        return
      }
      seenDocs.add(key)
    }
    records.push(rec)
  })
  return { records, skipped }
}

/** Genera un CSV (separado por comas, con BOM para que Excel respete las tildes). */
export function toCSV(headers, rows) {
  return `﻿${Papa.unparse({ fields: headers, data: rows })}`
}
