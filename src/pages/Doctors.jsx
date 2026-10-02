import { useMemo, useState } from 'react'
import { Avatar, EmptyState, Modal, RecordForm } from '../components/ui.jsx'
import { useData } from '../data/DataContext.jsx'
import { DOCTOR_COLORS, emptyRecord } from '../lib/schema.js'
import { fullName, sortBy, todayISO } from '../lib/utils.js'

export default function Doctors() {
  const { doctores, citas, atenciones, create, update, remove } = useData()
  const [editing, setEditing] = useState(null)
  const today = todayISO()

  const stats = useMemo(() => {
    const m = new Map()
    for (const d of doctores) {
      m.set(d.id, {
        proximas: citas.filter((c) => c.doctorId === d.id && c.estado !== 'Cancelada' && c.inicio.slice(0, 10) >= today).length,
        atenciones: atenciones.filter((a) => a.doctorId === d.id).length,
      })
    }
    return m
  }, [doctores, citas, atenciones, today])

  const close = () => setEditing(null)
  const newDoctor = () => setEditing({ ...emptyRecord('doctores'), color: DOCTOR_COLORS[doctores.length % DOCTOR_COLORS.length] })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Doctores</h1>
          <p className="muted">Profesionales que atienden en el consultorio</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={newDoctor}>+ Nuevo doctor</button>
      </div>

      {doctores.length === 0 ? <EmptyState>Registra a los doctores para asignarles citas y atenciones.</EmptyState> : (
        <div className="cards">
          {sortBy(doctores, 'apellidos').map((d) => (
            <button type="button" key={d.id} className={`card doctor-card ${d.activo === 'No' ? 'inactive' : ''}`} onClick={() => setEditing(d)}>
              <Avatar name={fullName(d)} color={d.color} />
              <div>
                <strong>Dr(a). {fullName(d)}</strong>
                <div className="muted small">{d.especialidad || 'Odontología'}{d.cop ? ` · COP ${d.cop}` : ''}</div>
                <div className="muted small">{d.telefono}</div>
                <div className="small">{stats.get(d.id)?.proximas ?? 0} citas próximas · {stats.get(d.id)?.atenciones ?? 0} atenciones</div>
                {d.activo === 'No' && <span className="badge">Inactivo</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Editar doctor' : 'Nuevo doctor'} onClose={close}>
          <RecordForm
            table="doctores"
            initial={editing}
            onCancel={close}
            onDelete={editing.id ? async () => {
              const used = citas.some((c) => c.doctorId === editing.id) || atenciones.some((a) => a.doctorId === editing.id)
              if (used) {
                window.alert('Este doctor tiene citas o atenciones registradas. Márcalo como "Activo: No" en lugar de eliminarlo para conservar el historial.')
                return
              }
              if (!window.confirm(`¿Eliminar a ${fullName(editing)}?`)) return
              await remove('doctores', editing.id)
              close()
            } : null}
            onSubmit={async (rec) => {
              if (rec.id) await update('doctores', rec)
              else await create('doctores', rec)
              close()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
