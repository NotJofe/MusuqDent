import { formatDateTime, fullName, limaToDate, LIMA_TZ, whatsappNumber } from './utils.js'
import { clinicInfo } from '../config.js'

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function title(cita) {
  return `Cita dental - ${clinicInfo().name}${cita.motivo ? ` (${cita.motivo})` : ''}`
}

/** Texto de recordatorio para enviar al paciente. */
export function appointmentMessage(cita, paciente, doctor) {
  const clinic = clinicInfo()
  const lines = [
    `Hola ${paciente?.nombres ?? ''}, le recordamos su cita en *${clinic.name}*:`,
    `📅 ${formatDateTime(cita.inicio, { weekday: true })}`,
  ]
  if (doctor) lines.push(`🧑‍⚕️ Dr(a). ${fullName(doctor)}`)
  if (cita.motivo) lines.push(`🦷 ${cita.motivo}`)
  if (clinic.address) lines.push(`📍 ${clinic.address}`)
  if (clinic.phone) lines.push(`📞 ${clinic.phone}`)
  lines.push('Por favor, confirme su asistencia respondiendo este mensaje. ¡Gracias!')
  return lines.join('\n')
}

export function whatsappLink(cita, paciente, doctor) {
  const number = whatsappNumber(paciente?.telefono)
  const text = encodeURIComponent(appointmentMessage(cita, paciente, doctor))
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`
}

/** Enlace "Agregar a Google Calendar" que el paciente puede abrir sin iniciar sesión en MusuqDent. */
export function googleCalendarLink(cita, paciente, doctor) {
  const start = limaToDate(cita.inicio)
  const end = limaToDate(cita.fin) ?? start
  const clinic = clinicInfo()
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title(cita),
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    ctz: LIMA_TZ,
    details: [
      paciente ? `Paciente: ${fullName(paciente)}` : '',
      doctor ? `Doctor(a): ${fullName(doctor)}` : '',
      clinic.phone ? `Teléfono: ${clinic.phone}` : '',
    ].filter(Boolean).join('\n'),
  })
  if (clinic.address) params.set('location', clinic.address)
  return `https://calendar.google.com/calendar/render?${params}`
}

function icsEscape(text) {
  return String(text ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

/** Archivo .ics compatible con Google Calendar, Outlook y el calendario del celular. */
export function icsContent(cita, paciente, doctor) {
  const start = limaToDate(cita.inicio)
  const end = limaToDate(cita.fin) ?? start
  const clinic = clinicInfo()
  const description = [
    paciente ? `Paciente: ${fullName(paciente)}` : '',
    doctor ? `Doctor(a): ${fullName(doctor)}` : '',
    clinic.phone ? `Teléfono: ${clinic.phone}` : '',
  ].filter(Boolean).join('\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MusuqDent//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${cita.id}@musuqdent`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsEscape(title(cita))}`,
    `DESCRIPTION:${icsEscape(description)}`,
    clinic.address ? `LOCATION:${icsEscape(clinic.address)}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio de cita dental',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}
