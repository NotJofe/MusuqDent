import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { getConfig } from '../config.js'
import { TABLE_NAMES } from '../lib/schema.js'
import { newId } from '../lib/utils.js'
import { LocalStore } from './localStore.js'
import { AuthError, SheetsStore } from './sheetsStore.js'

const DataContext = createContext(null)
const PREFIX = { pacientes: 'p', doctores: 'd', atenciones: 'a', pagos: 'g', citas: 'c' }
const empty = () => Object.fromEntries(TABLE_NAMES.map((t) => [t, []]))

export function DataProvider({ children }) {
  const { session, getToken, logout } = useAuth()
  const [data, setData] = useState(empty)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(0)
  const storeRef = useRef(null)

  const handleError = useCallback((err) => {
    if (err instanceof AuthError) logout(err.message)
    throw err
  }, [logout])

  const reload = useCallback(async () => {
    const store = storeRef.current
    if (!store) return
    setStatus('loading')
    setError('')
    try {
      await store.init()
      setData(await store.loadAll())
      setStatus('ready')
    } catch (err) {
      if (err instanceof AuthError) {
        logout(err.message)
        return
      }
      setError(err.message)
      setStatus('error')
    }
  }, [logout])

  useEffect(() => {
    if (!session) return
    storeRef.current = session.mode === 'google'
      ? new SheetsStore({ spreadsheetId: getConfig().spreadsheetId, getToken })
      : new LocalStore()
    reload()
  }, [session, getToken, reload])

  /** Ejecuta una escritura mostrando el indicador de "guardando". */
  const run = useCallback(async (fn) => {
    setSaving((n) => n + 1)
    try {
      return await fn(storeRef.current)
    } catch (err) {
      return handleError(err)
    } finally {
      setSaving((n) => n - 1)
    }
  }, [handleError])

  const createMany = useCallback(async (table, records) => {
    const now = new Date().toISOString()
    const full = records.map((r) => ({ ...r, id: newId(PREFIX[table]), creadoEn: now, actualizadoEn: now }))
    await run((s) => s.insert(table, full))
    setData((d) => ({ ...d, [table]: [...d[table], ...full] }))
    return full
  }, [run])

  const create = useCallback(async (table, record) => (await createMany(table, [record]))[0], [createMany])

  const update = useCallback(async (table, record) => {
    const full = { ...record, actualizadoEn: new Date().toISOString() }
    await run((s) => s.update(table, full))
    setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === full.id ? full : r)) }))
    return full
  }, [run])

  const remove = useCallback(async (table, id) => {
    await run((s) => s.remove(table, id))
    setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }))
  }, [run])

  const value = useMemo(() => {
    const byId = Object.fromEntries(
      TABLE_NAMES.map((t) => [t, Object.fromEntries(data[t].map((r) => [r.id, r]))]),
    )
    return {
      ...data,
      byId,
      status,
      error,
      saving: saving > 0,
      sheetUrl: storeRef.current?.url ?? null,
      reload,
      create,
      createMany,
      update,
      remove,
    }
  }, [data, status, error, saving, reload, create, createMany, update, remove])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
