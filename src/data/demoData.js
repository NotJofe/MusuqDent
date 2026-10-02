import { addMinutes, newId, todayISO } from '../lib/utils.js'

/** Datos de ejemplo para el modo demostración (fechas relativas a hoy). */
export function demoData() {
  const now = new Date().toISOString()
  const today = todayISO()
  const day = (offset) => {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  const stamp = { creadoEn: now, actualizadoEn: now }

  const doctores = [
    { id: newId('d'), nombres: 'Lucía', apellidos: 'Quispe Mamani', especialidad: 'Odontología general', cop: '12345', telefono: '987654321', email: '', numeroDocumento: '', color: '#0f766e', activo: 'Sí', ...stamp },
    { id: newId('d'), nombres: 'Carlos', apellidos: 'Huamán Torres', especialidad: 'Ortodoncia', cop: '23456', telefono: '976543210', email: '', numeroDocumento: '', color: '#2563eb', activo: 'Sí', ...stamp },
  ]
  const base = { tipoDocumento: 'DNI', email: '', direccion: '', alergias: '', notas: '', ...stamp }
  const pacientes = [
    { ...base, id: newId('p'), nombres: 'María', apellidos: 'Condori Flores', numeroDocumento: '45678912', fechaNacimiento: '1990-03-14', telefono: '912345678', direccion: 'Av. El Sol 123, Cusco' },
    { ...base, id: newId('p'), nombres: 'José', apellidos: 'Ramírez Ccahuana', numeroDocumento: '40123456', fechaNacimiento: '', telefono: '923456789', alergias: 'Penicilina' },
    { ...base, id: newId('p'), nombres: 'Rosa', apellidos: 'Gutiérrez Apaza', numeroDocumento: '71234567', fechaNacimiento: '2001-11-02', telefono: '934567890' },
  ]
  const [lucia, carlos] = doctores
  const [maria, jose, rosa] = pacientes

  const atenciones = [
    { id: newId('a'), pacienteId: maria.id, doctorId: lucia.id, fecha: day(-30), tratamiento: 'Profilaxis', piezaDental: '', diagnostico: 'Placa bacteriana leve', costo: '80', notas: '', ...stamp },
    { id: newId('a'), pacienteId: maria.id, doctorId: lucia.id, fecha: day(-7), tratamiento: 'Curación con resina', piezaDental: '36', diagnostico: 'Caries oclusal', costo: '150', notas: '', ...stamp },
    { id: newId('a'), pacienteId: jose.id, doctorId: carlos.id, fecha: day(-14), tratamiento: 'Evaluación de ortodoncia', piezaDental: '', diagnostico: 'Apiñamiento anterior', costo: '50', notas: '', ...stamp },
  ]
  const pagos = [
    { id: newId('g'), pacienteId: maria.id, atencionId: atenciones[0].id, fecha: day(-30), monto: '80', metodo: 'Yape', concepto: 'Profilaxis', comprobante: '', notas: '', ...stamp },
    { id: newId('g'), pacienteId: maria.id, citaId: '', atencionId: atenciones[1].id, fecha: day(-7), monto: '100', metodo: 'Efectivo', concepto: 'Adelanto resina', comprobante: '', notas: '', ...stamp },
    { id: newId('g'), pacienteId: jose.id, atencionId: atenciones[2].id, fecha: day(-14), monto: '50', metodo: 'Plin', concepto: 'Evaluación', comprobante: '', notas: '', ...stamp },
  ]
  const cita = (pac, doc, d, time, mins, motivo, estado = 'Programada', costo = '', atencionId = '') => {
    const inicio = `${day(d)}T${time}`
    return { id: newId('c'), pacienteId: pac.id, doctorId: doc.id, inicio, fin: addMinutes(inicio, mins), motivo, estado, costo, atencionId, notas: '', ...stamp }
  }
  const citas = [
    cita(maria, lucia, 0, '09:00', 30, 'Control de resina', 'Confirmada', '40'),
    cita(rosa, lucia, 0, '11:00', 60, 'Profilaxis', 'Programada', '80'),
    cita(jose, carlos, 1, '16:00', 45, 'Instalación de brackets'),
    cita(rosa, carlos, 3, '10:30', 30, 'Evaluación'),
    cita(maria, lucia, -7, '15:00', 60, 'Curación con resina', 'Atendida', '150', atenciones[1].id),
  ]
  return { pacientes, doctores, atenciones, pagos, citas }
}
