import { TABLE_NAMES } from '../lib/schema.js'
import { demoData } from './demoData.js'

const KEY = 'musuqdent.demo.data'

/**
 * Almacén para el modo demostración: guarda los datos solo en este navegador (localStorage).
 * Tiene la misma interfaz que SheetsStore.
 */
export class LocalStore {
  constructor() {
    this.url = null
  }

  read() {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* datos corruptos: se regeneran */ }
    const data = demoData()
    this.write(data)
    return data
  }

  write(data) {
    localStorage.setItem(KEY, JSON.stringify(data))
  }

  async init() {}

  async loadAll() {
    const data = this.read()
    for (const t of TABLE_NAMES) data[t] ??= []
    return data
  }

  async insert(table, records) {
    const data = await this.loadAll()
    data[table].push(...records)
    this.write(data)
  }

  async update(table, record) {
    const data = await this.loadAll()
    data[table] = data[table].map((r) => (r.id === record.id ? record : r))
    this.write(data)
  }

  async remove(table, id) {
    const data = await this.loadAll()
    data[table] = data[table].filter((r) => r.id !== id)
    this.write(data)
  }

  static reset() {
    localStorage.removeItem(KEY)
  }
}
