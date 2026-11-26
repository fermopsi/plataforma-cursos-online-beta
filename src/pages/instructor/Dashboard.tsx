import { Link } from 'react-router-dom'
import { ErrorBox, Loading } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Course, Lesson, Profile } from '@/lib/types'
import { fmtDate } from '@/lib/utils'

export default function InstructorDashboard() {
  const { profile } = useAuth()
  const { data, loading, error } = useAsync(async () => {
    const ci = must<{ course: Course }[]>(await sb().from('course_instructors').select('course:courses(*)').eq('instructor_id', profile!.id))
    const courses = ci.map((x) => x.course).filter(Boolean)
    const ids = courses.map((c) => c.id).concat('00000000-0000-0000-0000-000000000000')
    const [en, st, ls, pr] = await Promise.all([
      sb().from('enrollments').select('student_id,course_id,status,completed_at,last_activity_at').in('course_id', ids),
      sb().from('profiles').select('id,full_name,email'), sb().from('lessons').select('id,course_id,required,published').in('course_id', ids),
      sb().from('lesson_progress').select('student_id,lesson_id,course_id').in('course_id', ids),
    ])
    return { courses, enr: must<{ student_id: string; course_id: string; status: string; completed_at: string | null; last_activity_at: string | null }[]>(en),
      students: must<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(st), lessons: must<Lesson[]>(ls), prog: must<{ student_id: string; lesson_id: string; course_id: string }[]>(pr) }
  }, [profile?.id])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const pct = (sid: string, cid: string) => { const req = data.lessons.filter((l) => l.course_id === cid && l.published && l.required); const d = req.filter((l) => data.prog.some((p) => p.student_id === sid && p.lesson_id === l.id)).length; return req.length ? Math.round((d / req.length) * 100) : 0 }
  return (
    <div className="wrap">
      <h1>Panel del instructor</h1>
      <h2>Mis cursos</h2>
      {data.courses.length === 0 ? <div className="card mu">Todavía no tienes cursos asignados. Pide al administrador que te asigne uno.</div> : (
        <div className="grid">{data.courses.map((c) => {
          const en = data.enr.filter((e) => e.course_id === c.id && e.status === 'active'); const avg = en.length ? Math.round(en.reduce((a, e) => a + pct(e.student_id, c.id), 0) / en.length) : 0
          return <div key={c.id} className="card"><h3>{c.title}</h3><p className="mu">{en.length} estudiantes · {en.filter((e) => e.completed_at).length} completaron</p>
            <div className="bar"><i style={{ width: avg + '%' }} /></div><p className="mu">Progreso promedio: {avg}%</p>
            <div className="row"><Link className="btn s" to={`/instructor/cursos/${c.id}`}>Gestionar contenido</Link><Link className="btn s g" to={`/aula/${c.slug}`}>Ver aula</Link></div></div>
        })}</div>
      )}
      <h2 style={{ marginTop: 28 }}>Estudiantes de mis cursos</h2>
      <div className="card tw"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Progreso</th><th>Última actividad</th></tr></thead><tbody>
        {data.enr.filter((e) => e.status === 'active').map((e) => { const s = data.students.find((x) => x.id === e.student_id); const p = pct(e.student_id, e.course_id); return (
          <tr key={e.student_id + e.course_id}><td>{s?.full_name || s?.email}</td><td>{data.courses.find((c) => c.id === e.course_id)?.title}</td><td style={{ minWidth: 150 }}><div className="bar"><i style={{ width: p + '%' }} /></div><span className="mu">{p}%</span></td><td>{fmtDate(e.last_activity_at)}</td></tr>) })}
      </tbody></table>{data.enr.length === 0 && <p className="mu">Aún no hay estudiantes inscritos.</p>}</div>
    </div>
  )
}
