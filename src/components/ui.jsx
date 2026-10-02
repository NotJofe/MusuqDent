import { useEffect, useMemo, useState } from 'react'
import { TABLES } from '../lib/schema.js'
import { fullName, normalize, sortBy, validateRecord } from '../lib/utils.js'
import { useData } from '../data/DataContext.jsx'

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ children }) {
  return <div className="empty">{children}</div>
}

/** Selector de paciente con búsqueda por nombre, DNI o celular. */
export function PatientPicker({ value, onChange, invalid }) {
  const { pacientes, byId } = useData()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = byId.pacientes[value]
  const results = useMemo(() => {
    const q = normalize(query)
    const list = sortBy(pacientes, 'apellidos', 'nombres')
    if (!q) return list.slice(0, 8)
    return list.filter((p) => normalize(`${fullName(p)} ${p.numeroDocumento} ${p.telefono}`).includes(q)).slice(0, 8)
  }, [pacientes, query])

  return (
    <div className="picker">
      <input
        className={invalid ? 'invalid' : ''}
        value={open ? query : selected ? `${fullName(selected)} · ${selected.numeroDocumento}` : ''}
        placeholder="Buscar por nombre, DNI o celular…"
        onFocus={() => { setOpen(true); setQuery('') }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <ul className="picker-list">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={() => { onChange(p.id); setOpen(false) }}>
                <strong>{fullName(p)}</strong> <span className="muted">{p.numeroDocumento} · {p.telefono}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="muted picker-empty">Sin resultados</li>}
        </ul>
      )}
    </div>
  )
}

export function DoctorSelect({ value, onChange, includeEmpty = true, emptyLabel = '— Sin asignar —' }) {
  const { doctores } = useData()
  const list = sortBy(doctores.filter((d) => d.activo !== 'No' || d.id === value), 'apellidos')
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {includeEmpty && <option value="">{emptyLabel}</option>}
      {list.map((d) => <option key={d.id} value={d.id}>{fullName(d)}{d.especialidad ? ` (${d.especialidad})` : ''}</option>)}
    </select>
  )
}

function FieldInput({ field, value, onChange, invalid, record }) {
  const common = { id: `f-${field.key}`, className: invalid ? 'invalid' : '', value: value ?? '' }
  if (field.type === 'ref' && field.ref === 'pacientes') return <PatientPicker value={value} onChange={onChange} invalid={invalid} />
  if (field.type === 'ref' && field.ref === 'doctores') return <DoctorSelect value={value} onChange={onChange} />
  if (field.type === 'ref' && field.ref === 'atenciones') return <AttentionSelect pacienteId={record.pacienteId} value={value} onChange={onChange} />
  if (field.type === 'select') {
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        {!field.default && <option value="">—</option>}
        {field.options.map((o) => <option key={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'textarea') return <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />
  const type = { date: 'date', datetime: 'datetime-local', number: 'number', email: 'email', tel: 'tel', color: 'color' }[field.type] ?? 'text'
  return (
    <input
      {...common}
      type={type}
      step={field.type === 'number' ? '0.01' : field.type === 'datetime' ? 900 : undefined}
      min={field.type === 'number' ? 0 : undefined}
      inputMode={field.key === 'numeroDocumento' ? 'numeric' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function AttentionSelect({ pacienteId, value, onChange }) {
  const { atenciones } = useData()
  const list = sortBy(atenciones.filter((a) => a.pacienteId === pacienteId), '-fecha')
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Ninguna —</option>
      {list.map((a) => <option key={a.id} value={a.id}>{a.fecha} · {a.tratamiento}</option>)}
    </select>
  )
}

/**
 * Formulario genérico basado en el esquema de la tabla.
 * `hidden` oculta campos que ya vienen fijados (p. ej. el paciente en su ficha).
 */
export function RecordForm({ table, initial, onSubmit, onCancel, onDelete, hidden = [], submitLabel = 'Guardar', children }) {
  const data = useData()
  const [record, setRecord] = useState(initial)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const fields = TABLES[table].fields.filter((f) => !hidden.includes(f.key))

  const submit = async (e) => {
    e.preventDefault()
    const errs = validateRecord(table, record, data[table])
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setFailure('')
    try {
      await onSubmit(record)
    } catch (err) {
      setFailure(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key} className={f.type === 'textarea' || f.type === 'ref' ? 'span-2' : ''} htmlFor={`f-${f.key}`}>
            <span>{f.label}{f.required && <em className="req">*</em>}</span>
            <FieldInput
              field={f}
              record={record}
              value={record[f.key]}
              invalid={Boolean(errors[f.key])}
              onChange={(v) => setRecord((r) => ({ ...r, [f.key]: v }))}
            />
            {errors[f.key] && <small className="error-text">{errors[f.key]}</small>}
          </label>
        ))}
      </div>
      {typeof children === 'function' ? children(record, setRecord) : children}
      {failure && <p className="alert alert-error">{failure}</p>}
      <div className="form-actions">
        {onDelete && (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={onDelete}>Eliminar</button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
      </div>
    </form>
  )
}

export function Avatar({ name, color }) {
  const initials = String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <span className="avatar" style={color ? { background: color } : undefined}>{initials || '?'}</span>
}

export function StateBadge({ estado }) {
  return <span className={`badge badge-${normalize(estado).replace(/\s/g, '-')}`}>{estado || 'Programada'}</span>
}
