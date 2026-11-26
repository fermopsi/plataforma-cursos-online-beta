import { FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, ErrorBox, Field, Loading, Modal, useToast } from '@/components/ui'
import { adminCreateUser, NO_FUNCTION_MSG } from '@/lib/adminApi'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Certificate, Course, Enrollment, Lesson, Payment, Profile } from '@/lib/types'
import { ENR_STATUS, PAY_STATUS, METHODS, fmtDate, moneyAlways } from '@/lib/utils'

export function AdminStudents() {
  const toast = useToast()
  const [q, setQ] = useState(''); const [st, setSt] = useState('all'); const [open, setOpen] = useState(false)
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, e] = await Promise.all([sb().from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }), sb().from('enrollments').select('student_id,status,last_activity_at')])
    return { students: must<Profile[]>(p), enr: must<{ student_id: string; status: string; last_activity_at: string | null }[]>(e) }
  }, [])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const toggle = async (s: Profile) => {
    const { error: er } = await sb().from('profiles').update({ active: !s.active }).eq('id', s.id)
    er ? toast(er.message, 'err') : (toast('Acceso actualizado'), reload())
  }
  const list = data.students.filter((s) => (st === 'all' || (st === 'active') === s.active) && (s.full_name + s.email).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row sp"><h1>Estudiantes</h1><button className="btn" onClick={() => setOpen(true)}>Nuevo estudiante</button></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="all">Todos</option><option value="active">Con acceso</option><option value="off">Suspendidos</option></select>
      </div>
      <div className="card tw"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Registro</th><th>Cursos</th><th>Última actividad</th><th>Acceso</th><th></th></tr></thead><tbody>
        {list.map((s) => {
          const en = data.enr.filter((e) => e.student_id === s.id)
          const last = en.map((e) => e.last_activity_at).filter(Boolean).sort().pop()
          return (
            <tr key={s.id}><td><Link to={`/admin/estudiantes/${s.id}`} style={{ fontWeight: 600 }}>{s.full_name || '(sin nombre)'}</Link></td><td>{s.email}</td><td>{s.phone ?? '—'}</td><td>{fmtDate(s.created_at)}</td>
              <td>{en.filter((e) => e.status === 'active').length}</td><td>{fmtDate(last)}</td>
              <td><Badge s={s.active ? 'active' : 'off'} label={s.active ? 'Activo' : 'Suspendido'} /></td>
              <td><div className="row"><Link className="btn s" to={`/admin/estudiantes/${s.id}`}>Ficha</Link><button className="btn s g" onClick={() => toggle(s)}>{s.active ? 'Suspender' : 'Reactivar'}</button></div></td></tr>
          )
        })}</tbody></table>{list.length === 0 && <p className="mu">No hay estudiantes con ese filtro.</p>}</div>
      {open && <NewUserModal role="student" onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload() }} />}
    </>
  )
}

export function NewUserModal({ role, onClose, onDone }: { role: 'student' | 'instructor'; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await adminCreateUser({ ...f, role }); toast(role === 'student' ? 'Estudiante creado' : 'Instructor creado'); onDone() }
    catch (x) { const m = (x as Error).message; setErr(m === 'NO_FUNCTION' ? NO_FUNCTION_MSG : m) }
    setBusy(false)
  }
  return (
    <Modal title={role === 'student' ? 'Nuevo estudiante' : 'Nuevo instructor'} onClose={onClose}>
      <form className="f" onSubmit={submit}>
        <Field label="Nombre completo"><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required minLength={3} /></Field>
        <Field label="Correo"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Teléfono (opcional)"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Contraseña inicial (mín. 8)"><input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} /></Field>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Guardar'}</button>
      </form>
    </Modal>
  )
}

type ER = Enrollment & { course: Course }
export function StudentDetail() {
  const { id } = useParams(); const toast = useToast()
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, e, pa, ce, pr] = await Promise.all([
      sb().from('profiles').select('*').eq('id', id).single(),
      sb().from('enrollments').select('*, course:courses(*)').eq('student_id', id).order('enrolled_at', { ascending: false }),
      sb().from('payments').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      sb().from('certificates').select('*').eq('student_id', id),
      sb().from('lesson_progress').select('lesson_id,course_id').eq('student_id', id),
    ])
    const enr = must<ER[]>(e).filter((x) => x.course)
    const ls = must<Lesson[]>(await sb().from('lessons').select('id,course_id,required,published').in('course_id', enr.map((x) => x.course_id).concat('00000000-0000-0000-0000-000000000000')))
    return { p: must<Profile>(p), enr, pay: must<Payment[]>(pa), certs: must<Certificate[]>(ce), prog: must<{ lesson_id: string; course_id: string }[]>(pr), ls }
  }, [id])
  const [f, setF] = useState<{ full_name: string; phone: string } | null>(null)
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const { p, enr, pay, certs, prog, ls } = data
  const form = f ?? { full_name: p.full_name, phone: p.phone ?? '' }
  const run = async (r: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error: er } = await r; er ? toast(er.message, 'err') : (toast(ok), reload()) }
  const stat = (cid: string) => { const req = ls.filter((l) => l.course_id === cid && l.published && l.required); const d = req.filter((l) => prog.some((x) => x.lesson_id === l.id)).length; return { d, t: req.length, p: req.length ? Math.round((d / req.length) * 100) : 0 } }
  const total = pay.filter((x) => ['paid', 'partial'].includes(x.status)).reduce((a, x) => a + Number(x.amount), 0)

  return (
    <>
      <Link className="mu" to="/admin/estudiantes">← Estudiantes</Link>
      <div className="row sp"><h1>{p.full_name || p.email}</h1>
        <div className="row"><Link className="btn" to={`/admin/pagos?student=${p.id}`}>Inscribir y registrar pago</Link>
          <button className="btn g" onClick={() => run(sb().from('profiles').update({ active: !p.active }).eq('id', p.id), 'Acceso actualizado')}>{p.active ? 'Suspender acceso' : 'Reactivar acceso'}</button></div></div>
      <div className="grid g2c">
        <form className="card f" onSubmit={(e) => { e.preventDefault(); run(sb().from('profiles').update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null }).eq('id', p.id), 'Datos guardados') }}>
          <h3>Información personal</h3>
          <Field label="Nombre completo"><input value={form.full_name} onChange={(e) => setF({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Correo"><input value={p.email} disabled /></Field>
          <Field label="Teléfono"><input value={form.phone} onChange={(e) => setF({ ...form, phone: e.target.value })} /></Field>
          <div className="mu">Registro: {fmtDate(p.created_at)} · Acceso: <Badge s={p.active ? 'active' : 'off'} label={p.active ? 'Activo' : 'Suspendido'} /></div>
          <button className="btn">Guardar</button>
        </form>
        <div className="card"><h3>Resumen</h3>
          <div className="grid g2c"><div><div className="mu">Cursos</div><div className="kpi">{enr.length}</div></div><div><div className="mu">Certificados</div><div className="kpi">{certs.length}</div></div>
            <div><div className="mu">Pagado</div><div className="kpi">{moneyAlways(total)}</div></div><div><div className="mu">Pagos</div><div className="kpi">{pay.length}</div></div></div></div>
      </div>

      <h2 style={{ marginTop: 22 }}>Cursos e inscripciones</h2>
      <div className="card tw"><table><thead><tr><th>Curso</th><th>Estado</th><th>Progreso</th><th>Inscrito</th><th></th></tr></thead><tbody>
        {enr.map((e) => { const s = stat(e.course_id); return (
          <tr key={e.id}><td>{e.course.title}</td><td><Badge s={e.status} label={ENR_STATUS[e.status]} /></td>
            <td style={{ minWidth: 160 }}><div className="bar"><i style={{ width: s.p + '%' }} /></div><span className="mu">{s.d}/{s.t} · {s.p}%{e.completed_at && ' · completado ' + fmtDate(e.completed_at)}</span></td><td>{fmtDate(e.enrolled_at)}</td>
            <td>{e.status === 'active' ? <button className="btn s g" onClick={() => run(sb().from('enrollments').update({ status: 'revoked' }).eq('id', e.id), 'Acceso revocado')}>Revocar acceso</button>
              : <button className="btn s" onClick={() => run(sb().from('enrollments').update({ status: 'active' }).eq('id', e.id), 'Acceso habilitado')}>Habilitar acceso</button>}</td></tr>) })}
      </tbody></table>{enr.length === 0 && <p className="mu">Sin inscripciones.</p>}</div>

      <h2 style={{ marginTop: 22 }}>Pagos</h2>
      <div className="card tw"><table><thead><tr><th>Fecha</th><th>Curso</th><th>Importe</th><th>Método</th><th>Estado</th></tr></thead><tbody>
        {pay.map((x) => <tr key={x.id}><td>{fmtDate(x.paid_at)}</td><td>{enr.find((e) => e.course_id === x.course_id)?.course.title ?? '—'}</td><td>{moneyAlways(x.amount, x.currency)}</td><td>{METHODS[x.method]}</td><td><Badge s={x.status} label={PAY_STATUS[x.status]} /></td></tr>)}
      </tbody></table>{pay.length === 0 && <p className="mu">Sin pagos registrados.</p>}</div>

      <h2 style={{ marginTop: 22 }}>Certificados</h2>
      <div className="card tw"><table><thead><tr><th>Curso</th><th>Código</th><th>Emitido</th><th></th></tr></thead><tbody>
        {certs.map((c) => <tr key={c.id}><td>{enr.find((e) => e.course_id === c.course_id)?.course.title ?? '—'}</td><td>{c.code}{c.revoked && <span className="st revoked" style={{ marginLeft: 6 }}>Revocado</span>}</td><td>{fmtDate(c.issued_at)}</td>
          <td><div className="row"><button className="btn s g" onClick={() => run(sb().from('certificates').update({ revoked: !c.revoked }).eq('id', c.id), c.revoked ? 'Certificado restaurado' : 'Certificado revocado')}>{c.revoked ? 'Restaurar' : 'Revocar'}</button>
            <button className="btn s g" onClick={async () => { try { const code = must<string>(await sb().rpc('reissue_certificate', { p_cert: c.id })); toast('Reemitido: ' + code); reload() } catch (x) { toast((x as Error).message, 'err') } }}>Reemitir</button></div></td></tr>)}
      </tbody></table>{certs.length === 0 && <p className="mu">Aún no hay certificados.</p>}</div>
    </>
  )
}
