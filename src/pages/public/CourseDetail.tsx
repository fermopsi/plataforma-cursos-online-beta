import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBox, Loading, courseImg, useToast } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import { useSettings } from '@/lib/settings'
import type { Category, Course, Enrollment, PubInstructor } from '@/lib/types'
import { LEVELS, money } from '@/lib/utils'

interface OutlineRow { module_id: string; module_title: string; module_position: number; lesson_id: string | null; lesson_title: string | null; lesson_position: number | null; duration_min: number | null }

export default function CourseDetail() {
  const { slug } = useParams()
  const { profile } = useAuth()
  const { settings: s } = useSettings()
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  const { data, loading, error } = useAsync(async () => {
    const course = must<Course | null>(await sb().from('courses').select('*').eq('slug', slug).maybeSingle())
    if (!course) return null
    const [cat, outline, ci, pi, enr] = await Promise.all([
      course.category_id ? sb().from('categories').select('*').eq('id', course.category_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      sb().rpc('course_outline', { p_course: course.id }),
      sb().from('course_instructors').select('instructor_id').eq('course_id', course.id),
      sb().from('public_instructors').select('*'),
      profile ? sb().from('enrollments').select('*').eq('course_id', course.id).eq('student_id', profile.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    const ids = must<{ instructor_id: string }[]>(ci).map((x) => x.instructor_id)
    return {
      course, category: must<Category | null>(cat), outline: must<OutlineRow[]>(outline),
      instructors: must<PubInstructor[]>(pi).filter((p) => ids.includes(p.id)), enrollment: must<Enrollment | null>(enr),
    }
  }, [slug, profile?.id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox msg={error} />
  if (!data) return <div className="wrap"><div className="card"><h2>Curso no encontrado</h2><Link className="btn" to="/cursos">Ver catálogo</Link></div></div>

  const { course: c, category, outline, instructors, enrollment } = data
  const mods = new Map<string, { title: string; pos: number; ls: OutlineRow[] }>()
  outline.forEach((r) => {
    if (!mods.has(r.module_id)) mods.set(r.module_id, { title: r.module_title, pos: r.module_position, ls: [] })
    if (r.lesson_id) mods.get(r.module_id)!.ls.push(r)
  })
  const modules = [...mods.values()].sort((a, b) => a.pos - b.pos)
  const nLes = modules.reduce((a, m) => a + m.ls.length, 0)
  const sum = (ls: OutlineRow[]) => ls.reduce((a, l) => a + (l.duration_min || 0), 0)
  const mins = modules.reduce((a, m) => a + sum(m.ls), 0)
  const wa = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Hola, quiero inscribirme en el curso: ${c.title}${c.price ? ` (${money(c.price, c.currency)})` : ''}`)}`

  const startFree = async () => {
    if (!profile) { nav('/ingresar', { state: { from: `/cursos/${c.slug}` } }); return }
    setBusy(true)
    try { must(await sb().rpc('enroll_free', { p_course: c.id })); toast('Curso gratis activado'); nav(`/aula/${c.slug}`) }
    catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const active = enrollment?.status === 'active'

  return (
    <div className="wrap">
      <div className="crumbs"><Link to="/cursos">Cursos</Link> / <b>{c.title}</b></div>
      <div className="chero">
        <div>
          {category && <span className="tag">{category.name}</span>}{c.price === 0 && <span className="tag free">Gratis</span>}
          {c.status !== 'published' && <span className="tag">Vista previa · {c.status === 'draft' ? 'borrador' : 'archivado'}</span>}
          <h1 style={{ marginTop: 10 }}>{c.title}</h1>
          <p>{c.short_description}</p>
          <div className="row meta">
            {instructors[0] && <span>Instructor: {instructors.map((i) => i.full_name).join(', ')}</span>}
            <span>Nivel: {LEVELS[c.level]}</span>{c.duration_label && <span>Duración: {c.duration_label}</span>}<span>{nLes} lecciones</span>
          </div>
        </div>
        <div className="cimg"><img src={courseImg(c, category?.icon)} alt={`Portada de ${c.title}`} /></div>
      </div>

      <div className="cbody">
        <div>
          {c.description && <><h2>Sobre este curso</h2><p className="mu prose" style={{ fontSize: 15 }}>{c.description}</p></>}
          <h2 style={{ marginTop: 28 }}>Qué aprenderás</h2>
          <ul className="ticks">{(c.objectives.length ? c.objectives : ['Aplicar los conceptos clave con casos reales', 'Obtener un certificado con código verificable']).map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h2 style={{ marginTop: 28 }}>A quién está dirigido</h2>
          <p className="mu">{c.audience || `Personas interesadas en ${category?.name.toLowerCase() ?? 'este tema'}. Nivel: ${LEVELS[c.level]}.`}</p>
          <h2 style={{ marginTop: 28 }}>Qué necesitas para comenzar</h2>
          {c.requirements.length ? <ul className="ticks">{c.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            : <p className="mu">Un dispositivo con conexión a internet. Los materiales se descargan desde cada lección.</p>}
          <h2 style={{ marginTop: 28 }}>Programa académico</h2>
          <p className="mu">{modules.length} módulos · {nLes} lecciones · {mins} min de contenido</p>
          {modules.map((m, a) => (
            <details key={a} className="acc" open={a === 0}>
              <summary><span className="num">{a + 1}</span><span><b>{m.title}</b><small className="mu">{m.ls.length} lecciones · {sum(m.ls)} min</small></span></summary>
              {m.ls.map((l) => <div key={l.lesson_id!} className="lr"><span>▶</span><span>{l.lesson_title}</span><span className="mu">{l.duration_min} min</span></div>)}
            </details>
          ))}
          {instructors.length > 0 && <>
            <h2 style={{ marginTop: 28 }}>Tu instructor</h2>
            {instructors.map((i) => (
              <div key={i.id} className="card row" style={{ marginBottom: 10, flexWrap: 'nowrap' }}>
                {i.avatar_url ? <img className="avatar" src={i.avatar_url} alt="" /> : <span className="avatar num" style={{ borderRadius: '50%' }}>{i.full_name[0]}</span>}
                <div><b>{i.full_name}</b>{i.specialty && <div className="mu">{i.specialty}</div>}{i.bio && <p className="mu" style={{ margin: '6px 0 0' }}>{i.bio}</p>}</div>
              </div>
            ))}
          </>}
        </div>

        <aside className="buy card">
          <div className="kpi">{money(c.price, c.currency)}</div>
          <p className="mu" style={{ margin: 0 }}>{c.price ? 'Pago único · acceso de por vida' : 'Acceso inmediato, sin pago'}</p>
          {active ? <Link className="btn" to={`/aula/${c.slug}`}>Ir al aula</Link>
            : enrollment?.status === 'pending' ? <div className="card mu">Tu inscripción está pendiente de confirmación de pago.</div>
            : c.price === 0 ? <button className="btn" disabled={busy} onClick={startFree}>Empezar gratis ahora</button>
            : <a className="btn" target="_blank" rel="noopener noreferrer" href={wa}>{s.enroll_cta_label}</a>}
          <div className="mu" style={{ lineHeight: 1.9 }}>{nLes} lecciones · {mins} min<br />Materiales descargables<br />Certificado con código único<br />Desde cualquier dispositivo</div>
        </aside>
      </div>
    </div>
  )
}
