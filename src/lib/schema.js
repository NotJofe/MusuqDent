// Definición de las "tablas" de MusuqDent. Cada tabla es una pestaña de la hoja de Google
// Sheets y cada campo es una columna. La primera fila de cada pestaña contiene las claves.

export const DOC_TYPES = ['DNI', 'CE', 'Pasaporte', 'RUC', 'Otro']
export const PAYMENT_METHODS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Otro']
export const APPOINTMENT_STATES = ['Programada', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió']
export const DOCTOR_COLORS = ['#0f766e', '#2563eb', '#9333ea', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#475569']

export const TABLES = {
  pacientes: {
    sheet: 'Pacientes',
    label: 'Pacientes',
    fields: [
      { key: 'nombres', label: 'Nombres', required: true },
      { key: 'apellidos', label: 'Apellidos', required: true },
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', options: DOC_TYPES, default: 'DNI' },
      { key: 'numeroDocumento', label: 'N° de documento', required: true, unique: true },
      { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date' },
      { key: 'telefono', label: 'Celular', required: true, type: 'tel' },
      { key: 'email', label: 'Correo', type: 'email' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'alergias', label: 'Alergias / antecedentes', type: 'textarea' },
      { key: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
  doctores: {
    sheet: 'Doctores',
    label: 'Doctores',
    fields: [
      { key: 'nombres', label: 'Nombres', required: true },
      { key: 'apellidos', label: 'Apellidos', required: true },
      { key: 'especialidad', label: 'Especialidad' },
      { key: 'cop', label: 'N° COP' },
      { key: 'numeroDocumento', label: 'DNI' },
      { key: 'telefono', label: 'Celular', type: 'tel' },
      { key: 'email', label: 'Correo', type: 'email' },
      { key: 'color', label: 'Color en agenda', type: 'color', default: DOCTOR_COLORS[0] },
      { key: 'activo', label: 'Activo', type: 'select', options: ['Sí', 'No'], default: 'Sí' },
    ],
  },
  atenciones: {
    sheet: 'Atenciones',
    label: 'Atenciones',
    fields: [
      { key: 'pacienteId', label: 'Paciente', required: true, type: 'ref', ref: 'pacientes' },
      { key: 'doctorId', label: 'Doctor', type: 'ref', ref: 'doctores' },
      { key: 'fecha', label: 'Fecha', required: true, type: 'date' },
      { key: 'tratamiento', label: 'Tratamiento', required: true },
      { key: 'piezaDental', label: 'Pieza dental' },
      { key: 'diagnostico', label: 'Diagnóstico', type: 'textarea' },
      { key: 'costo', label: 'Costo (S/)', type: 'number' },
      { key: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
  pagos: {
    sheet: 'Pagos',
    label: 'Pagos',
    fields: [
      { key: 'pacienteId', label: 'Paciente', required: true, type: 'ref', ref: 'pacientes' },
      { key: 'atencionId', label: 'Atención', type: 'ref', ref: 'atenciones' },
      { key: 'fecha', label: 'Fecha', required: true, type: 'date' },
      { key: 'citaId', label: 'Cita', type: 'ref', ref: 'citas', hidden: true },
      { key: 'monto', label: 'Monto (S/)', required: true, type: 'number' },
      { key: 'metodo', label: 'Método', type: 'select', options: PAYMENT_METHODS, default: 'Efectivo' },
      { key: 'concepto', label: 'Concepto' },
      { key: 'comprobante', label: 'N° comprobante' },
      { key: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
  citas: {
    sheet: 'Citas',
    label: 'Citas',
    fields: [
      { key: 'pacienteId', label: 'Paciente', required: true, type: 'ref', ref: 'pacientes' },
      { key: 'doctorId', label: 'Doctor', type: 'ref', ref: 'doctores' },
      { key: 'inicio', label: 'Inicio', required: true, type: 'datetime' },
      { key: 'fin', label: 'Fin', required: true, type: 'datetime' },
      { key: 'motivo', label: 'Motivo' },
      { key: 'estado', label: 'Estado', type: 'select', options: APPOINTMENT_STATES, default: 'Programada' },
      { key: 'costo', label: 'Costo del servicio (S/)', type: 'number' },
      { key: 'notas', label: 'Notas', type: 'textarea' },
      { key: 'atencionId', label: 'Atención', type: 'ref', ref: 'atenciones', hidden: true },
    ],
  },
}

export const TABLE_NAMES = Object.keys(TABLES)

/** Columnas que se guardan en la hoja para una tabla (en orden). */
export function columnsOf(table) {
  return ['id', ...TABLES[table].fields.map((f) => f.key), 'creadoEn', 'actualizadoEn']
}

/** Objeto vacío con los valores por defecto de la tabla. */
export function emptyRecord(table) {
  const rec = {}
  for (const f of TABLES[table].fields) rec[f.key] = f.default ?? ''
  return rec
}
