import { ErrorBox, Loading } from '@/components/ui'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import { fmtDate, moneyAlways, monthKey, monthsBack } from '@/lib/utils'

const LABEL: Record<string, (m: any) => string> = {
  'user.registered': () => 'Nuevo usuario registrado',
  'enrollment.created': (m) => `Nueva inscripción${m.course ? ': ' + m.course : ''}`,
  'payment.created': (m) => `Pago registrado${m.amount != null ? ': Bs ' + m.amount : ''}`,
  'course.published': (m) => `Curso publicado${m.title ? ': ' + m.title : ''}`,
  'certificate.issued': (m) => `Certificado emitido${m.course ? ': ' + m.course : ''}`,
  'certificate.reissued': () => 'Certificado reemitido',
  'platform.installed': () => 'Plataforma instalada',
}

export default function AdminDashboard() {
  const { data, loading, error } = useAsync(async () => {
    const [st, co, en, pa, lg] = await Promise.all([
      sb().from('profiles').select('id,active', { count: 'exact' }).eq('role', 'student'),
      sb().from('courses').select('id,title,status'),
      sb().from('enrollments').select('id,course_id,enrolled_at,status'),
      sb().from('payments').select('amount,status'),
      sb().from('activity_logs').select('*').order('created_at', { ascending: false }).limit(8),
    ])
    return {
      students: must<{ id: string; active: boolean }[]>(st), courses: must<{ id: string; title: string; status: string }[]>(co),
      enr: must<{ id: string; course_id: string; enrolled_at: string; status: string }[]>(en),
      pay: must<{ amount: number; status: string }[]>(pa), logs: must<{ id: number; action: string; meta: any; created_at: string }[]>(lg),
    }
  }, [])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const income = data.pay.filter((p) => ['paid', 'partial'].includes(p.status)).reduce((a, p) => a + Number(p.amount), 0)
  const pending = data.pay.filter((p) => p.status === 'pending').length
  const months = monthsBack(6).map((m) => ({ ...m, n: data.enr.filter((e) => monthKey(e.enrolled_at) === m.key).length }))
  const max = Math.max(1, ...months.map((m) => m.n))
  const top = data.courses.map((c) => ({ ...c, n: data.enr.filter((e) => e.course_id === c.id).length })).sort((a, b) => b.n - a.n).slice(0, 5)
  const kp: [string, string | number][] = [['Estudiantes', data.students.length], ['Estudiantes activos', data.students.filter((s) => s.active).length],
    ['Cursos publicados', data.courses.filter((c) => c.status === 'published').length], ['Cursos en borrador', data.courses.filter((c) => c.status === 'draft').length],
    ['Inscripciones', data.enr.length], ['Ingresos registrados', moneyAlways(income)], ['Pagos pendientes', pending], ['Inscripciones pendientes', data.enr.filter((e) => e.status === 'pending').length]]
  return (
    <>
      <h1>Resumen de la academia</h1>
      <div className="grid kp">{kp.map(([l, v]) => <div key={l} className="card"><div className="mu">{l}</div><div className="kpi">{v}</div></div>)}</div>
      <div className="grid g2c" style={{ marginTop: 16 }}>
        <div className="card"><b>Inscripciones por mes</b>
          <div className="bars">{months.map((m) => <div key={m.key} style={{ height: `${(m.n / max) * 100}%` }}><em>{m.n}</em><span>{m.label}</span></div>)}</div></div>
        <div className="card"><b>Cursos más inscritos</b>
          <table><tbody>{top.map((c) => <tr key={c.id}><td>{c.title}</td><td style={{ textAlign: 'right' }}><b>{c.n}</b></td></tr>)}</tbody></table>
          {top.length === 0 && <p className="mu">Aún no hay cursos.</p>}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><b>Actividad reciente</b>
        {data.logs.length === 0 && <p className="mu">Sin actividad todavía.</p>}
        {data.logs.map((l) => <div key={l.id} className="notif"><div>{(LABEL[l.action] ?? (() => l.action))(l.meta)}<div className="mu">{fmtDate(l.created_at)}</div></div></div>)}</div>
    </>
  )
}
