import { useState } from 'react'
import { useData } from '../data/DataContext.jsx'
import { appointmentBalance } from '../lib/finance.js'
import { emptyRecord } from '../lib/schema.js'
import { formatDate, formatMoney, todayISO, toNumber } from '../lib/utils.js'
import { RecordForm } from './ui.jsx'

/** Datos de una atención tomados de la cita. */
function attentionFromAppointment(cita) {
  return {
    ...emptyRecord('atenciones'),
    pacienteId: cita.pacienteId,
    doctorId: cita.doctorId ?? '',
    fecha: String(cita.inicio ?? '').slice(0, 10) || todayISO(),
    tratamiento: cita.motivo || 'Consulta',
    costo: cita.costo ?? '',
    notas: cita.notas ?? '',
  }
}

/** Enlaza la atención con la cita y mantiene el mismo costo en ambas. */
function linkPatch(cita, atencion) {
  const patch = { atencionId: atencion.id }
  if (String(atencion.costo ?? '').trim() !== '') patch.costo = atencion.costo
  return patch
}

/** Acciones disponibles cuando la cita está "Atendida": crear la atención y registrar pagos. */
export function AttendedPanel({ cita, onManual, onPay }) {
  const { byId, pagos, create, update } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const atencion = byId.atenciones[cita.atencionId]
  const balance = appointmentBalance(cita, pagos, atencion)
  const quick = attentionFromAppointment(cita)

  const createQuick = async () => {
    setBusy(true)
    setError('')
    try {
      const saved = await create('atenciones', quick)
      await update('citas', { ...cita, ...linkPatch(cita, saved) })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="attended">
      <section className="attended-block">
        <h3>🦷 Atención</h3>
        {atencion ? (
          <div className="attended-row">
            <div className="grow">
              <strong>✅ Atención registrada:</strong> {atencion.tratamiento} · {formatDate(atencion.fecha)}
              {atencion.costo ? ` · ${formatMoney(atencion.costo)}` : ''}
            </div>
            <button type="button" className="btn btn-small" onClick={onManual}>Editar atención</button>
          </div>
        ) : (
          <>
            <p className="muted small">Registra lo que se hizo en esta cita en el historial del paciente.</p>
            <div className="choice-grid">
              <button type="button" className="choice" onClick={createQuick} disabled={busy}>
                <strong>⚡ Rápida, con los datos de la cita</strong>
                <span className="muted small">
                  {quick.tratamiento} · {formatDate(quick.fecha)}{quick.costo ? ` · ${formatMoney(quick.costo)}` : ''}
                </span>
              </button>
              <button type="button" className="choice" onClick={onManual} disabled={busy}>
                <strong>✍️ Completar manualmente</strong>
                <span className="muted small">Agrega diagnóstico, pieza dental, costo y notas.</span>
              </button>
            </div>
          </>
        )}
      </section>

      <section className="attended-block">
        <h3>💵 Pago</h3>
        <div className="attended-row">
          <div className="grow pay-summary">
            <span>Costo: <strong>{balance.costo ? formatMoney(balance.costo) : 'sin definir'}</strong></span>
            <span>Pagado: <strong>{formatMoney(balance.pagado)}</strong></span>
            {balance.costo > 0 && (
              balance.pendiente > 0
                ? <span>Pendiente: <strong className="text-danger">{formatMoney(balance.pendiente)}</strong></span>
                : <span className="text-ok"><strong>✅ Pagado por completo</strong></span>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-small" onClick={onPay} disabled={busy}>Registrar pago</button>
        </div>
      </section>
      {error && <p className="alert alert-error">{error}</p>}
    </div>
  )
}

/** Formulario manual de la atención, precargado con los datos de la cita. */
export function AttentionFromAppointment({ cita, onDone, onCancel }) {
  const { byId, create, update } = useData()
  const existing = byId.atenciones[cita.atencionId]

  return (
    <RecordForm
      table="atenciones"
      initial={existing ?? attentionFromAppointment(cita)}
      hidden={['pacienteId']}
      onCancel={onCancel}
      submitLabel={existing ? 'Guardar atención' : 'Registrar atención'}
      onSubmit={async (rec) => {
        const saved = rec.id ? await update('atenciones', rec) : await create('atenciones', rec)
        const patch = linkPatch(cita, saved)
        if (patch.atencionId !== cita.atencionId || (patch.costo !== undefined && patch.costo !== cita.costo)) {
          await update('citas', { ...cita, ...patch })
        }
        onDone()
      }}
    />
  )
}

/** Registro de un pago de la cita. El costo del servicio es obligatorio para poder pagar. */
export function PaymentFromAppointment({ cita, onDone, onCancel }) {
  const { byId, pagos, create, update } = useData()
  const atencion = byId.atenciones[cita.atencionId]
  const [costo, setCosto] = useState(cita.costo || atencion?.costo || '')
  const balance = appointmentBalance({ ...cita, costo }, pagos, atencion)
  const costoValido = toNumber(costo) > 0

  const initial = {
    ...emptyRecord('pagos'),
    pacienteId: cita.pacienteId,
    citaId: cita.id,
    atencionId: cita.atencionId ?? '',
    fecha: todayISO(),
    monto: balance.pendiente > 0 ? String(balance.pendiente) : '',
    concepto: cita.motivo || atencion?.tratamiento || 'Consulta',
  }

  return (
    <>
      <div className="cost-box">
        <label htmlFor="costo-servicio">
          <span>Costo del servicio (S/)<em className="req">*</em></span>
          <input
            id="costo-servicio"
            type="number"
            min="0"
            step="0.01"
            value={costo}
            className={costoValido ? '' : 'invalid'}
            onChange={(e) => setCosto(e.target.value)}
          />
          {!costoValido && <small className="error-text">Ingresa el costo del servicio para registrar el pago.</small>}
        </label>
        <div className="pay-summary">
          <span>Pagado: <strong>{formatMoney(balance.pagado)}</strong></span>
          {costoValido && <span>Pendiente: <strong className={balance.pendiente > 0 ? 'text-danger' : 'text-ok'}>{formatMoney(balance.pendiente)}</strong></span>}
        </div>
      </div>
      <RecordForm
        table="pagos"
        initial={initial}
        hidden={['pacienteId', 'atencionId']}
        onCancel={onCancel}
        submitLabel="Registrar pago"
        onSubmit={async (rec) => {
          if (!costoValido) throw new Error('Ingresa el costo del servicio antes de registrar el pago.')
          if (toNumber(rec.monto) <= 0) throw new Error('El monto debe ser mayor a cero.')
          if (toNumber(rec.monto) > balance.pendiente + 0.001
            && !window.confirm(`El monto (${formatMoney(rec.monto)}) es mayor al saldo pendiente (${formatMoney(balance.pendiente)}). ¿Registrarlo de todas formas?`)) {
            return
          }
          const nuevoCosto = String(toNumber(costo))
          if (nuevoCosto !== String(cita.costo ?? '')) await update('citas', { ...cita, costo: nuevoCosto })
          // Si la atención enlazada no tiene costo, se completa con el de la cita
          if (atencion && !toNumber(atencion.costo)) await update('atenciones', { ...atencion, costo: nuevoCosto })
          await create('pagos', rec)
          onDone()
        }}
      />
    </>
  )
}
