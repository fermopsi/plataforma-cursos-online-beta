import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CertificateModal, CertData } from '@/components/Certificate'
import { ErrorBox, Loading, Ring, useToast } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Course, Enrollment, Lesson, Module, Resource } from '@/lib/types'

export default function Classroom() {
  const { slug } = useParams()
  const { profile } = useAuth()
  const toast = useToast()
  const [cur, setCur] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [cert, setCert] = useState<CertData | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, error } = useAsync(async () => {
    const course = must<Course | null>(await sb().from('courses').select('*').eq('slug', slug).maybeSingle())
    if (!course) return null
    const [m, l, r, p, e] = await Promise.all([
      sb().from('modules').select('*').eq('course_id', course.id).order('position'),
      sb().from('lessons').select('*').eq('course_id', course.id).order('position'),
      sb().from('lesson_resources').select('*').eq('course_id', course.id).order('created_at'),
      sb().from('lesson_progress').select('lesson_id').eq('course_id', course.id).eq('student_id', profile!.id),
      sb().from('enrollments').select('*').eq('course_id', course.id).eq('student_id', profile!.id).maybeSingle(),
    ])
    return {
      course, modules: must<Module[]>(m).filter((x) => x.published || profile!.role !== 'student'),
      lessons: must<Lesson[]>(l), resources: must<Resource[]>(r),
      progress: must<{ lesson_id: string }[]>(p).map((x) => x.lesson_id), enrollment: must<Enrollment | null>(e),
    }
  }, [slug, profile?.id])

  const flat = useMemo(() => {
    if (!data) return []
    return data.modules.flatMap((m) => data.lessons.filter((l) => l.module_id === m.id).sort((a, b) => a.position - b.position))
  }, [data])

  useEffect(() => {
    if (!data) return
    setDone(new Set(data.progress))
    const last = data.enrollment?.last_lesson_id
    const first = flat.find((l) => !data.progress.includes(l.id)) || flat[0]
    setCur(last && flat.some((l) => l.id === last) ? last : first?.id ?? null)
  }, [data, flat])

  const select = useCallback((id: string) => {
    setCur(id)
    if (data?.enrollment?.status === 'active') sb().rpc('touch_lesson', { p_lesson: id }).then(() => {})
  }, [data])

  const idx = flat.findIndex((l) => l.id === cur)
  const step = useCallback((d: number) => { const n = flat[idx + d]; if (n) select(n.id) }, [flat, idx, select])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return
      if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1)
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [step])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox msg={error} />
  if (!data) return <div className="wrap"><div className="card"><h2>Curso no encontrado</h2><Link className="btn" to="/estudiante">Volver</Link></div></div>

  const { course, modules, lessons, resources, enrollment } = data
  const preview = enrollment?.status !== 'active'
  const isStaff = profile!.role !== 'student'
  if (preview && !isStaff) {
    return <div className="wrap narrow"><div className="card"><h2>Aún no tienes acceso a este curso</h2><p className="mu">Cuando la academia confirme tu inscripción y pago, el curso aparecerá en tu aula.</p><div className="row"><Link className="btn" to={`/cursos/${course.slug}`}>Ver el curso</Link><Link className="btn g" to="/estudiante">Mis cursos</Link></div></div></div>
  }

  const lesson = lessons.find((l) => l.id === cur)
  const req = flat.filter((l) => l.published && l.required)
  const reqDone = req.filter((l) => done.has(l.id)).length
  const pct = req.length ? Math.round((reqDone / req.length) * 100) : 0
  const mats = resources.filter((r) => r.lesson_id === cur)

  const toggle = async () => {
    if (!lesson) return
    if (preview) return toast('Vista previa: el progreso solo se guarda para estudiantes inscritos')
    setBusy(true)
    try {
      const mark = !done.has(lesson.id)
      const r = must<{ percent: number; completed: boolean; certificate_code: string | null }>(await sb().rpc('set_lesson_progress', { p_lesson: lesson.id, p_done: mark }))
      const n = new Set(done); mark ? n.add(lesson.id) : n.delete(lesson.id); setDone(n)
      if (r.completed && mark) {
        toast('¡Curso completado!')
        const { data: c } = await sb().from('certificates').select('*').eq('course_id', course.id).eq('student_id', profile!.id).maybeSingle()
        if (c) setCert({ student: profile!.full_name, course: course.title, date: c.issued_at, code: c.code })
      } else if (mark) { toast(`Lección completada · ${r.percent}%`); step(1) }
    } catch (e) { toast((e as Error).message, 'err') }
    setBusy(false)
  }

  const open = async (r: Resource) => {
    if (r.url && !r.storage_path) { window.open(r.url, '_blank', 'noopener'); return }
    const { data: s, error: er } = await sb().storage.from('materials').createSignedUrl(r.storage_path!, 120, { download: r.name })
    if (er || !s) return toast('No se pudo abrir el material', 'err')
    window.open(s.signedUrl, '_blank', 'noopener')
  }

  return (
    <div className="wrap">
      <Link className="mu" to={profile!.role === 'student' ? '/estudiante' : profile!.role === 'admin' ? '/admin/cursos' : '/instructor'}>← Volver</Link>
      <h2>{course.title}{preview && <span className="tag" style={{ marginLeft: 8 }}>Vista previa</span>}</h2>
      <div className="cls">
        <div className="card">
          <div className="row"><Ring p={pct} /><div><b>{reqDone} de {req.length} lecciones</b><div className="mu">{pct === 100 ? 'Curso completado' : 'Sigue así, vas bien'}</div></div></div>
          <hr className="sep" />
          {modules.map((m, a) => {
            const ls = lessons.filter((l) => l.module_id === m.id).sort((x, y) => x.position - y.position)
            return (
              <div key={m.id} className="mod">
                <div className="row sp"><b>{m.title}</b><span className="mu">{ls.filter((l) => done.has(l.id)).length}/{ls.length}</span></div>
                {ls.map((l) => (
                  <div key={l.id} className={'les ' + (l.id === cur ? 'on' : '')} onClick={() => select(l.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && select(l.id)}>
                    <i className={'dot ' + (done.has(l.id) ? 'ok' : '')} /> {l.title}{!l.published && <span className="tag">borrador</span>}
                  </div>
                ))}
                {a < modules.length - 1 && <div style={{ height: 6 }} />}
              </div>
            )
          })}
        </div>

        <div>
          {!lesson ? <div className="card">Este curso aún no tiene lecciones publicadas.</div> : <>
            {lesson.youtube_id ? (
              <>
                <iframe className="vid" title="Video de la lección" src={`https://www.youtube-nocookie.com/embed/${lesson.youtube_id}?rel=0&playsinline=1`}
                  referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                <div className="mu" style={{ marginTop: 6 }}>¿No carga el video? <a style={{ textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" href={`https://youtu.be/${lesson.youtube_id}`}>Ábrelo en YouTube</a></div>
              </>
            ) : <div className="vid empty">Esta lección no tiene video; revisa el contenido y los materiales.</div>}
            <h3 style={{ marginTop: 12 }}>{lesson.title}</h3>
            {lesson.description && <p className="mu">{lesson.description}</p>}
            {lesson.content && <div className="card prose" style={{ margin: '10px 0' }}>{lesson.content}</div>}
            <div className="row">
              {mats.map((r) => <button key={r.id} className="btn s g" onClick={() => open(r)} title={r.description}>{r.kind === 'link' ? 'Enlace' : 'Material'}: {r.name}</button>)}
              {mats.length === 0 && <span className="mu">Esta lección no tiene materiales.</span>}
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn g" disabled={idx <= 0} onClick={() => step(-1)}>← Anterior</button>
              <button className="btn" disabled={busy} onClick={toggle}>{done.has(lesson.id) ? 'Marcar como pendiente' : 'Marcar como completada'}</button>
              <button className="btn g" disabled={idx >= flat.length - 1} onClick={() => step(1)}>Siguiente →</button>
            </div>
            <p className="mu">Atajo: usa las flechas ← → del teclado para cambiar de lección.</p>
          </>}
        </div>
      </div>
      {cert && <CertificateModal cert={cert} onClose={() => setCert(null)} />}
    </div>
  )
}
