import { FormEvent, useState } from 'react'
import { Badge, Editable, ErrorBox, Field, Icon, ICON_KEYS, Loading, Modal, useToast } from '@/components/ui'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Category, Course, Profile } from '@/lib/types'
import { slugify } from '@/lib/utils'
import { NewUserModal } from './Students'

export function AdminInstructors() {
  const toast = useToast()
  const [open, setOpen] = useState(false); const [promote, setPromote] = useState(false); const [edit, setEdit] = useState<Profile | null>(null)
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, ci, c, st] = await Promise.all([
      sb().from('profiles').select('*').eq('role', 'instructor').order('full_name'),
      sb().from('course_instructors').select('course_id,instructor_id'), sb().from('courses').select('id,title'),
      sb().from('profiles').select('id,full_name,email').eq('role', 'student').order('full_name'),
    ])
    return { ins: must<Profile[]>(p), links: must<{ course_id: string; instructor_id: string }[]>(ci), courses: must<Pick<Course, 'id' | 'title'>[]>(c), students: must<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(st) }
  }, [])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const toggle = async (p: Profile) => { const { error: e } = await sb().from('profiles').update({ active: !p.active }).eq('id', p.id); e ? toast(e.message, 'err') : (toast('Estado actualizado'), reload()) }
  return (
    <>
      <div className="row sp"><h1>Instructores</h1><div className="row"><button className="btn g" onClick={() => setPromote(true)}>Convertir un usuario existente</button><button className="btn" onClick={() => setOpen(true)}>Nuevo instructor</button></div></div>
      <p className="mu">Para asignar o quitar cursos, abre el curso en <b>Cursos → Editar</b> y marca al instructor.</p>
      <div className="card tw"><table><thead><tr><th>Instructor</th><th>Especialidad</th><th>Cursos asignados</th><th>Estado</th><th></th></tr></thead><tbody>
        {data.ins.map((p) => {
          const cs = data.links.filter((l) => l.instructor_id === p.id).map((l) => data.courses.find((c) => c.id === l.course_id)?.title).filter(Boolean)
          return <tr key={p.id}><td><b>{p.full_name}</b><div className="mu">{p.email}</div></td><td>{p.specialty ?? '—'}</td><td>{cs.length ? cs.join(', ') : '—'}</td>
            <td><Badge s={p.active ? 'active' : 'off'} label={p.active ? 'Activo' : 'Inactivo'} /></td>
            <td><div className="row"><button className="btn s" onClick={() => setEdit(p)}>Editar</button><button className="btn s g" onClick={() => toggle(p)}>{p.active ? 'Desactivar' : 'Activar'}</button></div></td></tr>
        })}</tbody></table>{data.ins.length === 0 && <p className="mu">Aún no hay instructores.</p>}</div>
      {open && <NewUserModal role="instructor" onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload() }} />}
      {edit && <EditInstructor p={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload() }} />}
      {promote && <PromoteModal students={data.students} onClose={() => setPromote(false)} onDone={() => { setPromote(false); reload() }} />}
    </>
  )
}

function EditInstructor({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [f, setF] = useState({ full_name: p.full_name, phone: p.phone ?? '', specialty: p.specialty ?? '', bio: p.bio ?? '' })
  const save = async (e: FormEvent) => { e.preventDefault(); const { error } = await sb().from('profiles').update({ ...f, phone: f.phone || null, specialty: f.specialty || null, bio: f.bio || null }).eq('id', p.id); error ? toast(error.message, 'err') : (toast('Instructor actualizado'), onDone()) }
  return (
    <Modal title="Editar instructor" onClose={onClose}><form className="f" onSubmit={save}>
      <Field label="Nombre completo"><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
      <Field label="Teléfono"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Especialidad"><input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></Field>
      <Field label="Biografía"><textarea rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
      <button className="btn">Guardar</button></form></Modal>
  )
}

function PromoteModal({ students, onClose, onDone }: { students: Pick<Profile, 'id' | 'full_name' | 'email'>[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [id, setId] = useState(students[0]?.id ?? '')
  const go = async () => { const { error } = await sb().from('profiles').update({ role: 'instructor' }).eq('id', id); error ? toast(error.message, 'err') : (toast('Ahora es instructor'), onDone()) }
  return (
    <Modal title="Convertir en instructor" onClose={onClose}>
      {students.length === 0 ? <p className="mu">No hay estudiantes registrados.</p> : <div className="f">
        <p className="mu">La persona debe haberse registrado antes (o haber sido creada como estudiante).</p>
        <select value={id} onChange={(e) => setId(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.email}</option>)}</select>
        <button className="btn" onClick={go}>Convertir</button></div>}
    </Modal>
  )
}

export function AdminCategories() {
  const toast = useToast(); const [name, setName] = useState(''); const [icon, setIcon] = useState('gestion')
  const { data, loading, error, reload } = useAsync(async () => {
    const [k, c] = await Promise.all([sb().from('categories').select('*').order('position'), sb().from('courses').select('category_id')])
    return { cats: must<Category[]>(k), used: must<{ category_id: string | null }[]>(c) }
  }, [])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const run = async (r: PromiseLike<{ error: { message: string } | null }>, ok?: string) => { const { error: e } = await r; e ? toast(e.message.includes('duplicate') ? 'Ya existe una categoría con ese nombre' : e.message, 'err') : (ok && toast(ok), reload()) }
  const add = (e: FormEvent) => { e.preventDefault(); run(sb().from('categories').insert({ name: name.trim(), slug: slugify(name), icon, position: data.cats.length + 1 }), 'Categoría creada'); setName('') }
  return (
    <>
      <h1>Categorías</h1>
      <form className="card row" onSubmit={add}><input placeholder="Nombre de la categoría" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={icon} onChange={(e) => setIcon(e.target.value)} style={{ maxWidth: 180 }}>{ICON_KEYS.map((k) => <option key={k} value={k}>Ícono: {k}</option>)}</select><button className="btn">Agregar</button></form>
      <div className="card tw" style={{ marginTop: 14 }}><table><thead><tr><th></th><th>Nombre</th><th>Ícono</th><th>Cursos</th><th></th></tr></thead><tbody>
        {data.cats.map((k) => { const n = data.used.filter((u) => u.category_id === k.id).length; return (
          <tr key={k.id}><td><Icon name={k.icon} size={22} /></td><td><Editable value={k.name} onCommit={(v) => run(sb().from('categories').update({ name: v.trim(), slug: slugify(v) }).eq('id', k.id), 'Nombre actualizado')} /></td>
            <td><select value={k.icon} onChange={(e) => run(sb().from('categories').update({ icon: e.target.value }).eq('id', k.id))}>{ICON_KEYS.map((i) => <option key={i} value={i}>{i}</option>)}</select></td><td>{n}</td>
            <td><button className="btn s g" onClick={() => { if (confirm(n ? `Esta categoría tiene ${n} curso(s); quedarán sin categoría. ¿Eliminar?` : '¿Eliminar categoría?')) run(sb().from('categories').delete().eq('id', k.id), 'Categoría eliminada') }}>Eliminar</button></td></tr>) })}
      </tbody></table></div>
    </>
  )
}
