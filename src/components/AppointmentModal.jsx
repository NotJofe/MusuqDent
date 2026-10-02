import { useState } from 'react'
import { useData } from '../data/DataContext.jsx'
import { emptyRecord } from '../lib/schema.js'
import { appointmentMessage, googleCalendarLink, icsContent, whatsappLink } from '../lib/share.js'
import { addMinutes, downloadFile, formatDateTime, fullName, minutesBetween } from '../lib/utils.js'
import { AttendedPanel, AttentionFromAppointment, PaymentFromAppointment } from './AttendedActions.jsx'
import { Modal, RecordForm } from './ui.jsx'

const DURATIONS = [15, 30, 45, 60, 90, 120]

const TITLES = {
  form: 'Editar cita',
  created: 'Cita agendada',
  attended: 'Cita atendida',
  atencion: 'Registrar atención',
  pago: 'Registrar pago',
}

/** Crear / editar una cita. `cita` sin id = nueva. */
export default function AppointmentModal({ cita, onClose }) {
  const { create, update, remove, byId } = useData()
  const isNew = !cita.id
  const [citaId, setCitaId] = useState(cita.id ?? null)
  // form → formulario de la cita; created → compartir; attended → acciones tras atender;
  // atencion / pago → formularios a partir de la cita
  const [view, setView] = useState('form')
  const [justAttended, setJustAttended] = useState(false)

  // Versión más reciente de la cita (refleja los cambios guardados en este mismo modal)
  const live = citaId ? byId.citas[citaId] ?? cita : null

  const initial = { ...emptyRecord('citas'), ...cita }
  if (!initial.fin && initial.inicio) initial.fin = addMinutes(initial.inicio, 30)

  const backToActions = () => setView('attended')
  const title = view === 'form' && isNew && !citaId ? 'Nueva cita' : TITLES[view]

  return (
    <Modal title={title} onClose={onClose} wide>
      {view === 'created' && live && <SharePanel cita={live} justCreated onClose={onClose} />}

      {view === 'attended' && live && (
        <>
          {justAttended && <p className="alert alert-success">✅ Cita de {fullName(byId.pacientes[live.pacienteId])} marcada como atendida.</p>}
          <AttendedPanel cita={live} onManual={() => setView('atencion')} onPay={() => setView('pago')} />
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => { setJustAttended(false); setView('form') }}>← Volver a la cita</button>
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onClose}>Listo</button>
          </div>
        </>
      )}

      {view === 'atencion' && live && <AttentionFromAppointment cita={live} onDone={backToActions} onCancel={backToActions} />}
      {view === 'pago' && live && <PaymentFromAppointment cita={live} onDone={backToActions} onCancel={backToActions} />}

      {view === 'form' && (
        <>
          <RecordForm
            key={live?.actualizadoEn ?? 'new'}
            table="citas"
            initial={live ?? initial}
            onCancel={onClose}
            submitLabel={citaId ? 'Guardar' : 'Agendar'}
            onDelete={citaId ? async () => {
              if (!window.confirm('¿Eliminar esta cita? Si el paciente no asistirá, también puedes marcarla como "Cancelada".')) return
              await remove('citas', citaId)
              onClose()
            } : null}
            onSubmit={async (rec) => {
              const wasAttended = live?.estado === 'Atendida'
              const saved = citaId ? await update('citas', rec) : await create('citas', rec)
              setCitaId(saved.id)
              if (saved.estado === 'Atendida') {
                // Al marcarla como atendida se ofrecen las acciones de atención y pago
                setJustAttended(!wasAttended)
                setView('attended')
              } else if (!citaId) {
                setView('created')
              } else {
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
          {live?.estado === 'Atendida' && (
            <div className="share-panel">
              <AttendedPanel cita={live} onManual={() => setView('atencion')} onPay={() => setView('pago')} />
            </div>
          )}
          {live && <SharePanel cita={live} />}
        </>
      )}
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
