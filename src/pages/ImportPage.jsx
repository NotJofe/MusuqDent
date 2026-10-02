import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext.jsx'
import { autoMap, buildRecords, IMPORT_TARGETS, importFields, parseFile, toCSV } from '../lib/importer.js'
import { downloadFile } from '../lib/utils.js'

const CHUNK = 200

export default function ImportPage() {
  const data = useData()
  const [table, setTable] = useState('pacientes')
  const [file, setFile] = useState(null) // { name, headers, rows }
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null)
  const [done, setDone] = useState(null)

  const fields = importFields(table)
  const result = useMemo(
    () => (file ? buildRecords(table, file.rows, mapping, { existing: data }) : null),
    [file, table, mapping, data],
  )

  const reset = () => { setFile(null); setMapping({}); setError(''); setDone(null) }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    reset()
    try {
      const parsed = await parseFile(f)
      setFile({ name: f.name, ...parsed })
      setMapping(autoMap(parsed.headers, table))
    } catch (err) {
      setError(err.message)
    }
  }

  const changeTable = (t) => {
    setTable(t)
    setDone(null)
    if (file) setMapping(autoMap(file.headers, t))
  }

  const template = () => {
    const headers = fields.map((f) => f.label)
    const example = {
      pacientes: ['María', 'Condori Flores', 'DNI', '45678912', '14/03/1990', '912345678', '', 'Av. El Sol 123', '', ''],
      doctores: ['Lucía', 'Quispe Mamani', 'Odontología general', '12345', '', '987654321', '', '', 'Sí'],
      atenciones: ['45678912', 'Lucía Quispe', '02/10/2026', 'Profilaxis', '', '', '80', ''],
      pagos: ['45678912', '02/10/2026', '80', 'Yape', 'Profilaxis', '', ''],
    }[table]
    downloadFile(`plantilla-${table}.csv`, toCSV(headers, [example]), 'text/csv;charset=utf-8')
  }

  const runImport = async () => {
    const records = result.records
    setError('')
    setProgress(0)
    try {
      for (let i = 0; i < records.length; i += CHUNK) {
        await data.createMany(table, records.slice(i, i + CHUNK))
        setProgress(Math.min(i + CHUNK, records.length))
      }
      setDone({ count: records.length, skipped: result.skipped.length })
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
    }
  }

  const missingRequired = fields.filter((f) => f.required && mapping[f.key] === undefined && !(f.key === 'nombres' && mapping._nombreCompleto !== undefined) && !(f.key === 'apellidos' && mapping._nombreCompleto !== undefined))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Importar datos</h1>
          <p className="muted">Carga pacientes, doctores, historial de atenciones o pagos desde Excel (.xlsx) o CSV.</p>
        </div>
      </div>

      <section className="card">
        <div className="import-steps">
          <label>
            <span>1. ¿Qué deseas importar?</span>
            <select value={table} onChange={(e) => changeTable(e.target.value)}>
              {Object.entries(IMPORT_TARGETS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </label>
          <label>
            <span>2. Selecciona el archivo</span>
            <input type="file" accept=".xlsx,.csv,.txt" onChange={onFile} />
          </label>
          <button type="button" className="link-btn" onClick={template}>Descargar plantilla de ejemplo</button>
        </div>
        {(table === 'atenciones' || table === 'pagos') && (
          <p className="muted small">Cada fila debe incluir el DNI del paciente, que ya debe estar registrado en MusuqDent. Importa primero a los pacientes.</p>
        )}
        {error && <p className="alert alert-error">{error}</p>}
        {done && <p className="alert alert-success">✅ Se importaron {done.count} registros.{done.skipped ? ` ${done.skipped} filas fueron omitidas.` : ''}</p>}
      </section>

      {file && result && (
        <>
          <section className="card">
            <h2>3. Relaciona las columnas de "{file.name}"</h2>
            <p className="muted small">{file.rows.length} filas encontradas. Revisa que cada dato corresponda a la columna correcta.</p>
            <div className="mapping">
              {mapping._nombreCompleto !== undefined && (
                <label>
                  <span>Nombre completo (se separa en nombres y apellidos)</span>
                  <ColumnSelect headers={file.headers} value={mapping._nombreCompleto} onChange={(v) => setMapping((m) => ({ ...m, _nombreCompleto: v }))} />
                </label>
              )}
              {fields.map((f) => (
                <label key={f.key}>
                  <span>{f.label}{f.required && <em className="req">*</em>}</span>
                  <ColumnSelect headers={file.headers} value={mapping[f.key]} onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))} />
                </label>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>4. Vista previa</h2>
            <p>
              <strong>{result.records.length}</strong> registros listos para importar
              {result.skipped.length > 0 && <> · <strong className="text-danger">{result.skipped.length}</strong> filas se omitirán</>}
            </p>
            {result.records.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>{fields.filter((f) => !f.key.startsWith('_')).map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                  <tbody>
                    {result.records.slice(0, 5).map((r, i) => (
                      <tr key={i}>{fields.filter((f) => !f.key.startsWith('_')).map((f) => <td key={f.key}>{r[f.key]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.skipped.length > 0 && (
              <details className="skipped">
                <summary>Ver filas omitidas</summary>
                <ul>{result.skipped.slice(0, 100).map((s) => <li key={s.fila}>Fila {s.fila}: {s.motivo}</li>)}</ul>
              </details>
            )}
            {missingRequired.length > 0 && (
              <p className="alert alert-warn">Falta relacionar: {missingRequired.map((f) => f.label).join(', ')}</p>
            )}
            <div className="form-actions">
              <button type="button" className="btn" onClick={reset} disabled={progress !== null}>Cancelar</button>
              <span className="spacer" />
              <button type="button" className="btn btn-primary" onClick={runImport} disabled={!result.records.length || missingRequired.length > 0 || progress !== null}>
                {progress !== null ? `Importando… ${progress}/${result.records.length}` : `Importar ${result.records.length} registros`}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ColumnSelect({ headers, value, onChange }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}>
      <option value="">— No importar —</option>
      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
    </select>
  )
}
