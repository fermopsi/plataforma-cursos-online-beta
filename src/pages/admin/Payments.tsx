import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, ErrorBox, Field, Loading, Modal, useToast } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Course, Enrollment, Payment, Profile } from '@/lib/types'
import { ENR_STATUS, METHODS, PAY_STATUS, fmtDate, moneyAlways, safeName } from '@/lib/utils'

type PRow = Payment & { student: Pick<Profile, 'full_name' | 'email'> | null; course: Pick<Course, 'title'> | null }
type ERow = Enrollment & { student: Pick<Profile, 'full_name' | 'email'> | null; course: Pick<Course, 'title'> | null }

export default function AdminPayments() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'pagos' | 'inscripciones'>('pagos')
  const [newOpen, setNewOpen] = useState(false)
  const [edit, setEdit] = useState<PRow | null>(null)
  const [fs, setFs] = useState({ q: '', status: 'all', method: 'all', course: 'all', from: '', to: '' })

  const { data, loading, error, reload } = useAsync(async () => {
    const [p, e, s, c] = await Promise.all([
      sb().from('payments').select('*, student:profiles!student_id(full_name,email), course:courses(title)').order('created_at', { ascending: false }),
      sb().from('enrollments').select('*, student:profiles(full_name,email), course:courses(title)').order('enrolled_at', { ascending: false }),
      sb().from('profiles').select('id,full_name,email').eq('role', 'student').order('full_name'),
      sb().from('courses').select('id,title,price,currency').order('title'),
    ])
    return { pay: must<PRow[]>(p), enr: must<ERow[]>(e), students: must<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(s), courses: must<Pick<Course, 'id' | 'title' | 'price' | 'currency'>[]>(c) }
  }, [])

  useEffect(() => { if (params.get('student')) setNewOpen(true) }, [params])

  const rows = useMemo(() => (data?.pay ?? []).filter((p) =>
    (fs.status === 'all' || p.status === fs.status) && (fs.method === 'all' || p.method === fs.method) && (fs.course === 'all' || p.course_id === fs.course) &&
    (!fs.from || p.paid_at >= fs.from) && (!fs.to || p.paid_at <= fs.to) &&
    ((p.student?.full_name ?? '') + (p.student?.email ?? '') + (p.reference ?? '')).toLowerCase().includes(fs.q.toLowerCase())), [data, fs])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const sum = (st: string[]) => rows.filter((p) => st.includes(p.status)).reduce((a, p) => a + Number(p.amount), 0)
  const byMethod = Object.keys(METHODS).map((m) => ({ m, v: rows.filter((p) => p.method === m && ['paid', 'partial'].includes(p.status)).reduce((a, p) => a + Number(p.amount), 0) }))
  const setEnr = async (e: ERow, status: string) => { const { error: er } = await sb().from('enrollments').update({ status }).eq('id', e.id); er ? toast(er.message, 'err') : (toast('Inscripción actualizada'), reload()) }
  const receipt = async (path: string) => { const { data: s } = await sb().storage.from('receipts').createSignedUrl(path, 120); s ? window.open(s.signedUrl, '_blank', 'noopener') : toast('No se pudo abrir el comprobante', 'err') }

  return (
    <>
      <div className="row sp"><h1>Inscripciones y pagos</h1><button className="btn" onClick={() => setNewOpen(true)}>Inscribir y registrar pago</button></div>
      <div className="grid kp" style={{ marginBottom: 14 }}>
        <div className="card"><div className="mu">Ingresos registrados</div><div className="kpi">{moneyAlways(sum(['paid', 'partial']))}</div></div>
        <div className="card"><div className="mu">Pagos pendientes</div><div className="kpi">{rows.filter((p) => p.status === 'pending').length}</div></div>
        <div className="card"><div className="mu">Pagos parciales</div><div className="kpi">{rows.filter((p) => p.status === 'partial').length}</div></div>
        <div className="card"><div className="mu">Transacciones</div><div className="kpi">{rows.length}</div></div>
      </div>
      <div className="card row" style={{ marginBottom: 14 }}><b>Por método:</b>{byMethod.map((x) => <span key={x.m} className="tag">{METHODS[x.m]}: {moneyAlways(x.v)}</span>)}</div>

      <div className="tabs"><button className={tab === 'pagos' ? 'on' : ''} onClick={() => setTab('pagos')}>Pagos ({data.pay.length})</button><button className={tab === 'inscripciones' ? 'on' : ''} onClick={() => setTab('inscripciones')}>Inscripciones ({data.enr.length})</button></div>

      {tab === 'pagos' ? <>
        <div className="row" style={{ marginBottom: 12 }}>
          <input placeholder="Buscar estudiante o referencia" value={fs.q} onChange={(e) => setFs({ ...fs, q: e.target.value })} />
          <select value={fs.status} onChange={(e) => setFs({ ...fs, status: e.target.value })}><option value="all">Todos los estados</option>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={fs.method} onChange={(e) => setFs({ ...fs, method: e.target.value })}><option value="all">Todos los métodos</option>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={fs.course} onChange={(e) => setFs({ ...fs, course: e.target.value })}><option value="all">Todos los cursos</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          <input type="date" value={fs.from} onChange={(e) => setFs({ ...fs, from: e.target.value })} aria-label="Desde" /><input type="date" value={fs.to} onChange={(e) => setFs({ ...fs, to: e.target.value })} aria-label="Hasta" />
        </div>
        <div className="card tw"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Importe</th><th>Método</th><th>Fecha</th><th>Referencia</th><th>Estado</th><th></th></tr></thead><tbody>
          {rows.map((p) => <tr key={p.id}><td>{p.student?.full_name || p.student?.email}</td><td>{p.course?.title}</td><td>{moneyAlways(p.amount, p.currency)}</td><td>{METHODS[p.method]}</td><td>{fmtDate(p.paid_at)}</td><td>{p.reference ?? '—'}</td>
            <td><Badge s={p.status} label={PAY_STATUS[p.status]} /></td>
            <td><div className="row"><button className="btn s g" onClick={() => setEdit(p)}>Editar</button>{p.receipt_path && <button className="btn s g" onClick={() => receipt(p.receipt_path!)}>Comprobante</button>}</div></td></tr>)}
        </tbody></table>{rows.length === 0 && <p className="mu">No hay pagos con esos filtros.</p>}</div>
      </> : (
        <div className="card tw"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Inscrito</th><th>Estado</th><th></th></tr></thead><tbody>
          {data.enr.map((e) => <tr key={e.id}><td>{e.student?.full_name || e.student?.email}</td><td>{e.course?.title}</td><td>{fmtDate(e.enrolled_at)}</td><td><Badge s={e.status} label={ENR_STATUS[e.status]} /></td>
            <td>{e.status === 'active' ? <button className="btn s g" onClick={() => setEnr(e, 'revoked')}>Revocar acceso</button> : <button className="btn s" onClick={() => setEnr(e, 'active')}>Habilitar acceso</button>}</td></tr>)}
        </tbody></table>{data.enr.length === 0 && <p className="mu">Aún no hay inscripciones.</p>}</div>
      )}

      {newOpen && <NewPayment students={data.students} courses={data.courses} presel={params.get('student') ?? ''} onClose={() => { setNewOpen(false); setParams({}) }} onDone={() => { setNewOpen(false); setParams({}); reload() }} />}
      {edit && <EditPayment p={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload() }} />}
    </>
  )
}

function NewPayment({ students, courses, presel, onClose, onDone }: { students: Pick<Profile, 'id' | 'full_name' | 'email'>[]; courses: Pick<Course, 'id' | 'title' | 'price' | 'currency'>[]; presel: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const { profile } = useAuth()
  const [find, setFind] = useState('')
  const [f, setF] = useState({ student: presel || students[0]?.id || '', course: courses[0]?.id || '', amount: String(courses[0]?.price ?? 0), method: 'cash', status: 'paid', reference: '', notes: '', paid_at: new Date().toISOString().slice(0, 10) })
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false)
  const opts = students.filter((s) => (s.full_name + s.email).toLowerCase().includes(find.toLowerCase()))
  const course = courses.find((c) => c.id === f.course)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.student || !f.course) return toast('Elige estudiante y curso', 'err')
    setBusy(true)
    try {
      const grants = ['paid', 'partial'].includes(f.status)
      let enr = must<{ id: string; status: string } | null>(await sb().from('enrollments').select('id,status').eq('student_id', f.student).eq('course_id', f.course).maybeSingle())
      if (!enr) enr = must<{ id: string; status: string }>(await sb().from('enrollments').insert({ student_id: f.student, course_id: f.course, status: grants ? 'active' : 'pending' }).select('id,status').single())
      else if (grants && enr.status !== 'active') must(await sb().from('enrollments').update({ status: 'active' }).eq('id', enr.id))
      let receipt_path: string | null = null
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error('El comprobante debe pesar menos de 10 MB')
        receipt_path = `${f.student}/${Date.now()}-${safeName(file.name)}`
        const up = await sb().storage.from('receipts').upload(receipt_path, file); if (up.error) throw new Error(up.error.message)
      }
      must(await sb().from('payments').insert({ enrollment_id: enr.id, student_id: f.student, course_id: f.course, amount: Math.max(0, +f.amount || 0), currency: course?.currency ?? 'BOB',
        method: f.method, status: f.status, reference: f.reference.trim() || null, notes: f.notes.trim() || null, receipt_path, paid_at: f.paid_at, created_by: profile!.id }))
      toast(grants ? 'Inscripción y pago registrados · acceso habilitado' : 'Pago registrado · el acceso se habilitará al confirmarlo'); onDone()
    } catch (x) { toast((x as Error).message, 'err') }
    setBusy(false)
  }
  return (
    <Modal title="Inscribir y registrar pago" onClose={onClose}>
      <form className="f" onSubmit={submit}>
        <Field label="Estudiante"><input placeholder="Buscar por nombre o correo" value={find} onChange={(e) => setFind(e.target.value)} />
          <select size={Math.min(5, Math.max(2, opts.length))} value={f.student} onChange={(e) => setF({ ...f, student: e.target.value })}>{opts.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.email}</option>)}</select></Field>
        <Field label="Curso"><select value={f.course} onChange={(e) => setF({ ...f, course: e.target.value, amount: String(courses.find((c) => c.id === e.target.value)?.price ?? 0) })}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
        <div className="row"><Field label="Importe"><input type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Fecha"><input type="date" value={f.paid_at} onChange={(e) => setF({ ...f, paid_at: e.target.value })} /></Field></div>
        <div className="row"><Field label="Método"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Estado"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field></div>
        <Field label="Referencia (opcional)"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Comprobante (opcional)"><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <Field label="Observaciones"><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Confirmar'}</button>
      </form>
    </Modal>
  )
}

function EditPayment({ p, onClose, onDone }: { p: PRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [f, setF] = useState({ status: p.status, amount: String(p.amount), reference: p.reference ?? '', notes: p.notes ?? '' })
  const save = async (e: FormEvent) => { e.preventDefault(); const { error } = await sb().from('payments').update({ status: f.status, amount: Math.max(0, +f.amount || 0), reference: f.reference || null, notes: f.notes || null }).eq('id', p.id); error ? toast(error.message, 'err') : (toast('Pago actualizado'), onDone()) }
  return (
    <Modal title="Editar pago" onClose={onClose}><form className="f" onSubmit={save}>
      <p className="mu">{p.student?.full_name} · {p.course?.title}</p>
      <Field label="Estado"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Payment['status'] })}>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <p className="mu">Pagado/Parcial habilita el acceso al curso; Cancelado/Reembolsado lo revoca.</p>
      <Field label="Importe"><input type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
      <Field label="Referencia"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      <Field label="Observaciones"><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <button className="btn">Guardar</button></form></Modal>
  )
}
