import esLocale from '@fullcalendar/core/locales/es'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useMemo, useState } from 'react'
import AppointmentModal from '../components/AppointmentModal.jsx'
import { DoctorSelect } from '../components/ui.jsx'
import { useData } from '../data/DataContext.jsx'
import { addMinutes, fullName, toLimaParts } from '../lib/utils.js'

// El calendario trabaja en "UTC" con las horas de pared de Lima: así se muestra siempre la hora
// del consultorio sin importar la zona horaria del equipo y sin plugins adicionales.
const wall = (date) => date.toISOString().slice(0, 16)

const VIEW_KEY = 'musuqdent.calendar.view'

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) || (window.innerWidth < 700 ? 'listWeek' : 'timeGridWeek')
  } catch {
    return 'timeGridWeek'
  }
}

export default function CalendarPage() {
  const { citas, byId, update } = useData()
  const [doctorFilter, setDoctorFilter] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')

  const events = useMemo(() => citas
    .filter((c) => (!doctorFilter || c.doctorId === doctorFilter) && (showCancelled || c.estado !== 'Cancelada'))
    .map((c) => {
      const p = byId.pacientes[c.pacienteId]
      const d = byId.doctores[c.doctorId]
      const color = d?.color || '#64748b'
      return {
        id: c.id,
        title: `${p ? fullName(p) : 'Paciente eliminado'}${c.motivo ? ` · ${c.motivo}` : ''}`,
        start: c.inicio,
        end: c.fin,
        backgroundColor: color,
        borderColor: color,
        classNames: [`estado-${c.estado?.replace(/\s/g, '-').toLowerCase() || 'programada'}`],
        extendedProps: { doctor: d ? fullName(d) : '' },
      }
    }), [citas, byId, doctorFilter, showCancelled])

  // Mover o redimensionar una cita en el calendario
  const reschedule = async (info) => {
    const cita = byId.citas[info.event.id]
    const inicio = wall(info.event.start)
    const fin = info.event.end ? wall(info.event.end) : addMinutes(inicio, 30)
    try {
      setError('')
      await update('citas', { ...cita, inicio, fin })
    } catch (e) {
      info.revert()
      setError(e.message)
    }
  }

  return (
    <div className="page page-calendar">
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <p className="muted">Haz clic en un horario libre para agendar, o arrastra una cita para moverla.</p>
        </div>
        <div className="actions">
          <DoctorSelect value={doctorFilter} onChange={setDoctorFilter} emptyLabel="Todos los doctores" />
          <label className="checkbox">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Ver canceladas
          </label>
          <button type="button" className="btn btn-primary" onClick={() => {
            const now = toLimaParts(new Date())
            setModal({ inicio: `${now.date}T${String(Math.min(Number(now.time.slice(0, 2)) + 1, 20)).padStart(2, '0')}:00`, doctorId: doctorFilter })
          }}
          >+ Nueva cita</button>
        </div>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="card calendar-card">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={esLocale}
          timeZone="UTC"
          now={() => toLimaParts(new Date()).datetime}
          initialView={readView()}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
          buttonText={{ list: 'Lista' }}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          slotDuration="00:15:00"
          slotLabelInterval="01:00"
          allDaySlot={false}
          nowIndicator
          selectable
          selectMirror
          editable
          dayMaxEvents={4}
          events={events}
          datesSet={(arg) => { try { localStorage.setItem(VIEW_KEY, arg.view.type) } catch { /* sin almacenamiento */ } }}
          select={(info) => {
            const inicio = wall(info.start)
            // En la vista de mes la selección es de días completos: se propone las 09:00
            const allDay = info.allDay
            setModal({
              inicio: allDay ? `${inicio.slice(0, 10)}T09:00` : inicio,
              fin: allDay ? `${inicio.slice(0, 10)}T09:30` : wall(info.end),
              doctorId: doctorFilter,
            })
          }}
          eventClick={(info) => setModal(byId.citas[info.event.id])}
          eventDrop={reschedule}
          eventResize={reschedule}
          eventContent={(arg) => (
            <div className="fc-event-inner">
              <b>{arg.timeText}</b> <span>{arg.event.title}</span>
              {arg.event.extendedProps.doctor && arg.view.type !== 'dayGridMonth' && <div className="fc-doctor">Dr(a). {arg.event.extendedProps.doctor}</div>}
            </div>
          )}
        />
      </div>
      {modal && <AppointmentModal cita={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
