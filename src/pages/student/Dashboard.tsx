import { Link, useNavigate } from 'react-router-dom'
import { CertificateModal, CertData } from '@/components/Certificate'
import { Empty, ErrorBox, Loading, Ring, courseImg } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Category, Certificate, Course, Enrollment, Lesson, Notification } from '@/lib/types'
import { fmtDate, firstName } from '@/lib/utils'
import { useState } from 'react'

type Row = Enrollment & { course: Course }

export default function StudentDashboard() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [cert, setCert] = useState<CertData | null>(null)
  const { data, loading, error, reload } = useAsync(async () => {
    const uid = profile!.id
    const [en, ls, pr, ce, no, cat, fr] = await Promise.all([
      sb().from('enrollments').select('*, course:courses(*)').eq('student_id', uid).eq('status', 'active').order('last_activity_at', { ascending: false, nullsFirst: false }),
      sb().from('lessons').select('id,course_id,required,published'),
      sb().from('lesson_progress').select('lesson_id,course_id'),
      sb().from('certificates').select('*').eq('student_id', uid).eq('revoked', false),
      sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(8),
      sb().from('categories').select('*'),
      sb().from('courses').select('id,slug,title').eq('status', 'published').eq('price', 0),
    ])
    return {
      enr: must<Row[]>(en).filter((e) => e.course), lessons: must<Pick<Lesson, 'id' | 'course_id' | 'required' | 'published'>[]>(ls),
      prog: must<{ lesson_id: string; course_id: string }[]>(pr), certs: must<Certificate[]>(ce), notifs: must<Notification[]>(no),
      cats: must<Category[]>(cat), free: must<Pick<Course, 'id' | 'slug' | 'title'>[]>(fr),
    }
  }, [profile?.id])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || 'Sin datos'} />
  const stat = (cid: string) => {
    const req = data.lessons.filter((l) => l.course_id === cid && l.published && l.required)
    const done = req.filter((l) => data.prog.some((p) => p.lesson_id === l.id)).length
    return { t: req.length, d: done, p: req.length ? Math.round((done / req.length) * 100) : 0 }
  }
  const stats = data.enr.map((e) => ({ e, s: stat(e.course_id) }))
  const completed = stats.filter((x) => x.s.p === 100).length
  const freeOffer = data.free.find((f) => !data.enr.some((e) => e.course_id === f.id))
  const unread = data.notifs.filter((n) => !n.read).length

  const markRead = async () => { await sb().from('notifications').update({ read: true }).eq('user_id', profile!.id).eq('read', false); reload() }
  const openCert = (courseId: string) => {
    const c = data.certs.find((x) => x.course_id === courseId); const e = data.enr.find((x) => x.course_id === courseId)
    if (c && e) setCert({ student: profile!.full_name, course: e.course.title, date: c.issued_at, code: c.code })
  }

  return (
    <div className="wrap">
      <div className="row sp">
        <div><h1>Hola, {firstName(profile!.full_name)}</h1>
          <p className="mu">{completed} completado(s) · {stats.length - completed} en progreso · {data.certs.length} certificado(s)</p></div>
        <div className="row"><Link className="btn g s" to="/estudiante/certificados">Mis certificados</Link><Link className="btn g s" to="/estudiante/perfil">Mi perfil</Link></div>
      </div>

      {freeOffer && <div className="card row sp" style={{ margin: '12px 0' }}><span>Prueba gratis <b>{freeOffer.title}</b> y mira cómo avanza tu progreso.</span><Link className="btn s" to={`/cursos/${freeOffer.slug}`}>Empezar gratis</Link></div>}

      <h2 style={{ marginTop: 18 }}>Mis cursos</h2>
      {stats.length === 0 ? <Empty>Aún no tienes cursos habilitados. <Link to="/cursos" style={{ textDecoration: 'underline' }}>Explora el catálogo</Link> o escríbenos para inscribirte.</Empty> : (
        <div className="grid">
          {stats.map(({ e, s }) => (
            <div key={e.id} className="card">
              <div className="row sp"><img src={courseImg(e.course, data.cats.find((k) => k.id === e.course.category_id)?.icon)} alt="" style={{ width: 96, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8 }} />
                <span className={'st ' + (s.p === 100 ? 'paid' : 'partial')}>{s.p === 100 ? 'Completado' : 'En curso'}</span></div>
              <h3 style={{ marginTop: 8 }}>{e.course.title}</h3>
              <div className="bar"><i style={{ width: s.p + '%' }} /></div>
              <p className="mu">{s.d} de {s.t} lecciones · {s.p}%{e.last_activity_at && <> · última actividad {fmtDate(e.last_activity_at)}</>}</p>
              <div className="row">
                <button className="btn s" onClick={() => nav(`/aula/${e.course.slug}`)}>{s.p === 100 ? 'Repasar' : 'Continuar aprendiendo'}</button>
                {s.p === 100 && data.certs.some((c) => c.course_id === e.course_id) && <button className="btn s g" onClick={() => openCert(e.course_id)}>Ver certificado</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="row sp" style={{ marginTop: 28 }}><h2 style={{ margin: 0 }}>Notificaciones {unread > 0 && <span className="tag">{unread} nuevas</span>}</h2>{unread > 0 && <button className="btn s g" onClick={markRead}>Marcar todas como leídas</button>}</div>
      <div className="card" style={{ marginTop: 10 }}>
        {data.notifs.length === 0 ? <span className="mu">No tienes notificaciones.</span> : data.notifs.map((n) => (
          <div key={n.id} className={'notif ' + (n.read ? '' : 'unread')}><div><b>{n.title}</b><div className="mu">{n.body} · {fmtDate(n.created_at)}</div></div></div>
        ))}
      </div>
      {cert && <CertificateModal cert={cert} onClose={() => setCert(null)} />}
    </div>
  )
}
