import { describe, expect, it } from 'vitest'
import { googleCalendarLink, icsContent, whatsappLink } from './share.js'

const cita = { id: 'c1', inicio: '2026-10-05T09:30', fin: '2026-10-05T10:00', motivo: 'Profilaxis' }
const paciente = { nombres: 'María', apellidos: 'Condori', telefono: '912345678' }

describe('share', () => {
  it('genera el enlace de WhatsApp con el número peruano', () => {
    const url = whatsappLink(cita, paciente, null)
    expect(url).toMatch(/^https:\/\/wa\.me\/51912345678\?text=/)
    expect(decodeURIComponent(url)).toContain('lunes 05 oct 2026, 09:30')
  })
  it('genera el enlace de Google Calendar en UTC', () => {
    const url = new URL(googleCalendarLink(cita, paciente, null))
    expect(url.searchParams.get('dates')).toBe('20261005T143000Z/20261005T150000Z')
  })
  it('genera un archivo .ics válido', () => {
    const ics = icsContent(cita, paciente, null)
    expect(ics).toContain('DTSTART:20261005T143000Z')
    expect(ics).toContain('UID:c1@musuqdent')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
  })
})
