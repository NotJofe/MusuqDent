import { columnsOf, TABLE_NAMES, TABLES } from '../lib/schema.js'
import { columnLetter, mergeHeader, objectToRow, rowsToObjects, sheetRange } from './rows.js'

const API = 'https://sheets.googleapis.com/v4/spreadsheets'

export class AuthError extends Error {}
export class AccessError extends Error {}

/**
 * Almacén de datos que usa una hoja de Google Sheets como base de datos.
 * Cada tabla es una pestaña; la fila 1 tiene las claves de las columnas.
 * Todas las llamadas se hacen directo desde el navegador con el token OAuth del usuario,
 * así que solo las cuentas con acceso de edición a la hoja pueden leer o escribir.
 */
export class SheetsStore {
  constructor({ spreadsheetId, getToken }) {
    this.spreadsheetId = spreadsheetId
    this.getToken = getToken
    this.sheetIds = {} // título → sheetId numérico (necesario para borrar filas)
    this.headers = {} // tabla → encabezado actual
  }

  async request(path, { method = 'GET', body, query } = {}) {
    const url = new URL(`${API}/${this.spreadsheetId}${path}`)
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401) throw new AuthError('La sesión expiró. Vuelve a iniciar sesión.')
    if (res.status === 403 || res.status === 404) {
      throw new AccessError('Tu cuenta no tiene acceso a la hoja de datos configurada, o la hoja no existe.')
    }
    if (!res.ok) {
      let msg = res.statusText
      try {
        msg = (await res.json()).error?.message ?? msg
      } catch { /* respuesta sin JSON */ }
      throw new Error(`Google Sheets: ${msg}`)
    }
    return res.status === 204 ? null : res.json()
  }

  /** Crea las pestañas y encabezados que falten. Se llama una vez al iniciar sesión. */
  async init() {
    const meta = await this.request('', { query: { fields: 'sheets.properties(sheetId,title)' } })
    for (const s of meta.sheets ?? []) this.sheetIds[s.properties.title] = s.properties.sheetId

    const missing = TABLE_NAMES.filter((t) => this.sheetIds[TABLES[t].sheet] === undefined)
    if (missing.length) {
      const res = await this.request(':batchUpdate', {
        method: 'POST',
        body: {
          requests: missing.map((t) => ({
            addSheet: { properties: { title: TABLES[t].sheet, gridProperties: { frozenRowCount: 1 } } },
          })),
        },
      })
      for (const r of res.replies ?? []) {
        const p = r.addSheet?.properties
        if (p) this.sheetIds[p.title] = p.sheetId
      }
    }

    const ranges = TABLE_NAMES.map((t) => sheetRange(TABLES[t].sheet, '1:1'))
    const query = new URLSearchParams()
    for (const r of ranges) query.append('ranges', r)
    const res = await this.request(`/values:batchGet?${query}`)
    const updates = []
    TABLE_NAMES.forEach((t, i) => {
      const current = res.valueRanges?.[i]?.values?.[0] ?? []
      const header = mergeHeader(current, columnsOf(t))
      this.headers[t] = header
      if (header.length !== current.length) {
        updates.push({ range: sheetRange(TABLES[t].sheet, 'A1'), values: [header] })
      }
    })
    if (updates.length) {
      await this.request('/values:batchUpdate', {
        method: 'POST',
        body: { valueInputOption: 'RAW', data: updates },
      })
    }
  }

  /** Lee todas las tablas en una sola llamada. */
  async loadAll() {
    const query = new URLSearchParams()
    for (const t of TABLE_NAMES) query.append('ranges', sheetRange(TABLES[t].sheet))
    const res = await this.request(`/values:batchGet?${query}`)
    const data = {}
    TABLE_NAMES.forEach((t, i) => {
      const values = res.valueRanges?.[i]?.values ?? []
      if (values[0]) this.headers[t] = mergeHeader(values[0], columnsOf(t))
      data[t] = rowsToObjects(values)
    })
    return data
  }

  async insert(table, records) {
    if (!records.length) return
    const header = this.headers[table] ?? columnsOf(table)
    await this.request(`/values/${encodeURIComponent(sheetRange(TABLES[table].sheet, 'A1'))}:append`, {
      method: 'POST',
      query: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
      body: { values: records.map((r) => objectToRow(r, header)) },
    })
  }

  /** Busca el número de fila (1-based) de un id leyendo solo la columna id. */
  async findRow(table, id) {
    const header = this.headers[table] ?? columnsOf(table)
    const col = columnLetter(header.indexOf('id'))
    const res = await this.request(
      `/values/${encodeURIComponent(sheetRange(TABLES[table].sheet, `${col}:${col}`))}`,
    )
    const idx = (res.values ?? []).findIndex((row) => String(row[0]) === String(id))
    if (idx < 1) throw new Error('El registro ya no existe en la hoja (¿lo borró otra persona?). Recarga los datos.')
    return idx + 1
  }

  async update(table, record) {
    const header = this.headers[table] ?? columnsOf(table)
    const row = await this.findRow(table, record.id)
    const range = sheetRange(TABLES[table].sheet, `A${row}:${columnLetter(header.length - 1)}${row}`)
    await this.request(`/values/${encodeURIComponent(range)}`, {
      method: 'PUT',
      query: { valueInputOption: 'RAW' },
      body: { values: [objectToRow(record, header)] },
    })
  }

  async remove(table, id) {
    const row = await this.findRow(table, id)
    await this.request(':batchUpdate', {
      method: 'POST',
      body: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: this.sheetIds[TABLES[table].sheet],
              dimension: 'ROWS',
              startIndex: row - 1,
              endIndex: row,
            },
          },
        }],
      },
    })
  }

  get url() {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
  }
}
