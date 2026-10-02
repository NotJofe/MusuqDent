import { useState } from 'react'
import { useData } from '../data/DataContext.jsx'
import { emptyRecord } from '../lib/schema.js'
import { appointmentMessage, googleCalendarLink, icsContent, whatsappLink } from '../lib/share.js'
import { addMinutes, downloadFile, formatDateTime, fullName, minutesBetween } from '../lib/utils.js'
import { Modal, RecordForm } from './ui.jsx'

const DURATIONS = [15, 30, 45, 60, 90, 120]

/** Crear / editar una cita. `cita` sin id = nueva. */
export default function AppointmentModal({ cita, onClose }) {
  const { create, update, remove } = useData()
  const isNew = !cita.id
  const [current, setCurrent] = useState(null)

  const initial = { ...emptyRecord('citas'), ...cita }
  if (!initial.fin && initial.inicio) initial.fin = addMinutes(initial.inicio, 30)

  return (
    <Modal title={isNew ? (current ? 'Cita agendada' : 'Nueva cita') : 'Editar cita'} onClose={onClose} wide>
      {isNew && current ? <SharePanel cita={current} justCreated onClose={onClose} /> : (
      <RecordForm
        table="citas"
        initial={initial}
        onCancel={onClose}
        submitLabel={isNew ? 'Agendar' : 'Guardar'}
        onDelete={isNew ? null : async () => {
          if (!window.confirm('¿Eliminar esta cita? Si el paciente no asistirá, también puedes marcarla como "Cancelada".')) return
          await remove('citas', cita.id)
          onClose()
        }}
        onSubmit={async (rec) => {
          if (isNew) {
            const saved = await create('citas', rec)
            setCurrent(saved)
          } else {
            await update('citas', rec)
            onClose()
          }
        }}
      >
        {(rec, setRec) => (
          <div className="durations">
            <span className="muted small">Duración:</span>
            {DURATIONS.map((m) => (
              <button
                type="button"
                key={m}
                className={`chip ${minutesBetween(rec.inicio, rec.fin) === m ? 'chip-active' : ''}`}
                disabled={!rec.inicio}
                onClick={() => setRec((r) => ({ ...r, fin: addMinutes(r.inicio, m) }))}
              >
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </button>
            ))}
          </div>
        )}
      </RecordForm>
      )}
      {!isNew && <SharePanel cita={cita} />}
    </Modal>
  )
}

/** Opciones para compartir la cita con el paciente. */
export function SharePanel({ cita, justCreated, onClose }) {
  const { byId } = useData()
  const paciente = byId.pacientes[cita.pacienteId]
  const doctor = byId.doctores[cita.doctorId]
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(appointmentMessage(cita, paciente, doctor))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="share-panel">
      {justCreated && <p className="alert alert-success">✅ Cita agendada para {fullName(paciente)} el {formatDateTime(cita.inicio, { weekday: true })}.</p>}
      <h3>Compartir con el paciente</h3>
      <div className="share-actions">
        <a className="btn btn-whatsapp" href={whatsappLink(cita, paciente, doctor)} target="_blank" rel="noreferrer">
          Enviar por WhatsApp
        </a>
        <a className="btn" href={googleCalendarLink(cita, paciente, doctor)} target="_blank" rel="noreferrer">
          Agregar a Google Calendar
        </a>
        <button type="button" className="btn" onClick={() => downloadFile(`cita-${cita.inicio.slice(0, 10)}.ics`, icsContent(cita, paciente, doctor), 'text/calendar;charset=utf-8')}>
          Descargar .ics
        </button>
        <button type="button" className="btn" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar mensaje'}</button>
      </div>
      <p className="muted small">
        El mensaje de WhatsApp incluye fecha, hora y doctor. El enlace de Google Calendar y el archivo .ics permiten
        al paciente guardar la cita en su celular con un recordatorio.
      </p>
      {justCreated && <div className="form-actions"><span className="spacer" /><button type="button" className="btn btn-primary" onClick={onClose}>Listo</button></div>}
    </div>
  )
}
