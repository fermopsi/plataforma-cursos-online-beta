import { useState } from 'react'
import { ErrorBox, Loading } from '@/components/ui'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import { METHODS, PAY_STATUS, downloadText, moneyAlways, toCsv } from '@/lib/utils'

export default function AdminReports() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const { data, loading, error } = useAsync(async () => {
    const [c, e, p, ce, pr, ins] = await Promise.all([
      sb().from('courses').select('id,title,status'), sb().from('enrollments').select('course_id,status,completed_at,enrolled_at'),
      sb().from('payments').select('course_id,amount,status,method,paid_at'), sb().from('certificates').select('course_id,issued_at'),
      sb().from('profiles').select('role,active'), sb().from('course_instructors').select('course_id'),
    ])
    return { courses: must<{ id: string; title: string; status: string }[]>(c), enr: must<{ course_id: string; status: string; completed_at: string | null; enrolled_at: string }[]>(e),
      pay: must<{ course_id: string; amount: number; status: string; method: string; paid_at: string }[]>(p), certs: must<{ course_id: string; issued_at: string }[]>(ce),
      profiles: must<{ role: string; active: boolean }[]>(pr), links: must<{ course_id: string }[]>(ins) }
  }, [])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const inR = (d: string) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to)
  const enr = data.enr.filter((e) => inR(e.enrolled_at)); const pay = data.pay.filter((p) => inR(p.paid_at)); const certs = data.certs.filter((c) => inR(c.issued_at))
  const paid = (x: { status: string }) => ['paid', 'partial'].includes(x.status)

  const byCourse = data.courses.map((c) => {
    const e = enr.filter((x) => x.course_id === c.id)
    return { Curso: c.title, Inscritos: e.filter((x) => x.status === 'active').length, Completados: e.filter((x) => x.completed_at).length,
      'En progreso': e.filter((x) => x.status === 'active' && !x.completed_at).length, Certificados: certs.filter((x) => x.course_id === c.id).length,
      Ingresos: pay.filter((p) => p.course_id === c.id && paid(p)).reduce((a, p) => a + Number(p.amount), 0) }
  })
  const byMethod = Object.entries(METHODS).map(([k, v]) => ({ Método: v, Pagos: pay.filter((p) => p.method === k && paid(p)).length, Ingresos: pay.filter((p) => p.method === k && paid(p)).reduce((a, p) => a + Number(p.amount), 0) }))
  const byStatus = Object.entries(PAY_STATUS).map(([k, v]) => ({ Estado: v, Pagos: pay.filter((p) => p.status === k).length, Importe: pay.filter((p) => p.status === k).reduce((a, p) => a + Number(p.amount), 0) }))
  const admin = [{ Concepto: 'Estudiantes', Total: data.profiles.filter((p) => p.role === 'student').length }, { Concepto: 'Instructores', Total: data.profiles.filter((p) => p.role === 'instructor').length },
    { Concepto: 'Cursos', Total: data.courses.length }, { Concepto: 'Inscripciones', Total: enr.length }]

  const Tbl = ({ title, rows, file, money = [] }: { title: string; rows: Record<string, string | number>[]; file: string; money?: string[] }) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row sp"><h3 style={{ margin: 0 }}>{title}</h3><button className="btn s g" onClick={() => downloadText(`${file}.csv`, toCsv(rows))} disabled={!rows.length}>Exportar CSV</button></div>
      <div className="tw"><table><thead><tr>{rows[0] && Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{Object.entries(r).map(([k, v]) => <td key={k}>{money.includes(k) ? moneyAlways(Number(v)) : v}</td>)}</tr>)}</tbody></table></div>
    </div>
  )
  return (
    <>
      <h1>Reportes</h1>
      <div className="row" style={{ marginBottom: 14 }}><label className="lb">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="lb">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(from || to) && <button className="btn s g" onClick={() => { setFrom(''); setTo('') }}>Limpiar</button>}</div>
      <Tbl title="Académico y comercial por curso" rows={byCourse} file="reporte-cursos" money={['Ingresos']} />
      <div className="grid g2c"><Tbl title="Ingresos por método de pago" rows={byMethod} file="reporte-metodos" money={['Ingresos']} /><Tbl title="Pagos por estado" rows={byStatus} file="reporte-pagos-estado" money={['Importe']} /></div>
      <Tbl title="Resumen administrativo" rows={admin} file="reporte-administrativo" />
    </>
  )
}
