import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Editable, ErrorBox, Field, Loading, Modal, courseImg, useToast } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Category, Course, Lesson, Module, Profile, Resource } from '@/lib/types'
import { COURSE_STATUS, LEVELS, kindFromName, lines, safeName, slugify, ytId } from '@/lib/utils'

export default function CourseEditor() {
  const { id } = useParams()
  const { profile } = useAuth()
  const admin = profile!.role === 'admin'
  const toast = useToast()
  const [linkFor, setLinkFor] = useState<Lesson | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, error, reload } = useAsync(async () => {
    const course = must<Course>(await sb().from('courses').select('*').eq('id', id).single())
    const [cat, ins, ci, mo, le, re] = await Promise.all([
      sb().from('categories').select('*').order('position'),
      admin ? sb().from('profiles').select('*').eq('role', 'instructor').order('full_name') : Promise.resolve({ data: [], error: null }),
      sb().from('course_instructors').select('instructor_id').eq('course_id', course.id),
      sb().from('modules').select('*').eq('course_id', course.id).order('position'),
      sb().from('lessons').select('*').eq('course_id', course.id).order('position'),
      sb().from('lesson_resources').select('*').eq('course_id', course.id).order('created_at'),
    ])
    return {
      course, cats: must<Category[]>(cat), instructors: must<Profile[]>(ins), assigned: must<{ instructor_id: string }[]>(ci).map((x) => x.instructor_id),
      modules: must<Module[]>(mo), lessons: must<Lesson[]>(le), resources: must<Resource[]>(re),
    }
  }, [id])

  const [form, setForm] = useState<{ title: string; slug: string; short_description: string; description: string; category_id: string; level: string; duration_label: string; price: string; objectives: string; requirements: string; audience: string; status: string; featured: boolean } | null>(null)
  useEffect(() => {
    const c = data?.course; if (!c) return
    setForm({ title: c.title, slug: c.slug, short_description: c.short_description, description: c.description, category_id: c.category_id ?? '', level: c.level, duration_label: c.duration_label,
      price: String(c.price), objectives: c.objectives.join('\n'), requirements: c.requirements.join('\n'), audience: c.audience, status: c.status, featured: c.featured })
  }, [data?.course])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const { course, cats, instructors, assigned, modules, lessons, resources } = data
  const base = admin ? '/admin/cursos' : '/instructor'
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error: e } = await fn()
    if (e) toast(e.message, 'err'); else { if (ok) toast(ok); reload() }
  }

  /* ----- información del curso (solo admin) ----- */
  const saveInfo = async (e: FormEvent) => {
    e.preventDefault(); if (!form) return; setBusy(true)
    const { error: er } = await sb().from('courses').update({
      title: form.title.trim(), slug: slugify(form.slug) || course.slug, short_description: form.short_description.trim(), description: form.description.trim(),
      category_id: form.category_id || null, level: form.level, duration_label: form.duration_label.trim(), price: Math.max(0, +form.price || 0),
      objectives: lines(form.objectives), requirements: lines(form.requirements), audience: form.audience.trim(), status: form.status, featured: form.featured,
    }).eq('id', course.id)
    setBusy(false)
    if (er) return toast(er.message.includes('courses_slug_key') ? 'Ese enlace (slug) ya está en uso' : er.message, 'err')
    toast('Cambios guardados'); reload()
  }
  const uploadCover = async (file?: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast('La portada debe pesar menos de 5 MB', 'err')
    const path = `${course.id}/${Date.now()}-${safeName(file.name)}`
    const up = await sb().storage.from('covers').upload(path, file, { upsert: true })
    if (up.error) return toast(up.error.message, 'err')
    run(() => sb().from('courses').update({ cover_url: sb().storage.from('covers').getPublicUrl(path).data.publicUrl }).eq('id', course.id), 'Portada actualizada')
  }
  const toggleInstructor = (uid: string) =>
    run(() => assigned.includes(uid)
      ? sb().from('course_instructors').delete().eq('course_id', course.id).eq('instructor_id', uid)
      : sb().from('course_instructors').insert({ course_id: course.id, instructor_id: uid }))

  /* ----- módulos ----- */
  const addModule = () => run(() => sb().from('modules').insert({ course_id: course.id, title: 'Nuevo módulo', position: Math.max(0, ...modules.map((m) => m.position)) + 1 }), 'Módulo agregado')
  const purge = async (rs: Resource[]) => { const p = rs.map((r) => r.storage_path).filter(Boolean) as string[]; if (p.length) await sb().storage.from('materials').remove(p) }
  const delModule = async (m: Module) => {
    if (!confirm(`¿Eliminar el módulo "${m.title}" con todas sus lecciones y materiales?`)) return
    const ids = lessons.filter((l) => l.module_id === m.id).map((l) => l.id)
    await purge(resources.filter((r) => ids.includes(r.lesson_id)))
    run(() => sb().from('modules').delete().eq('id', m.id), 'Módulo eliminado')
  }
  const swap = async (table: 'modules' | 'lessons', list: { id: string; position: number }[], i: number, d: number) => {
    const j = i + d; if (!list[j]) return
    const arr = [...list];[arr[i], arr[j]] = [arr[j], arr[i]]
    const res = await Promise.all(arr.map((x, k) => (x.position !== k + 1 ? sb().from(table).update({ position: k + 1 }).eq('id', x.id) : null)).filter(Boolean) as PromiseLike<{ error: { message: string } | null }>[])
    const bad = res.find((r) => r.error)
    if (bad) toast(bad.error!.message, 'err'); else reload()
  }

  /* ----- lecciones ----- */
  const addLesson = (m: Module) => {
    const ls = lessons.filter((l) => l.module_id === m.id)
    return run(() => sb().from('lessons').insert({ module_id: m.id, course_id: course.id, title: 'Nueva lección', position: Math.max(0, ...ls.map((l) => l.position)) + 1 }), 'Lección agregada')
  }
  const delLesson = async (l: Lesson) => {
    if (!confirm(`¿Eliminar la lección "${l.title}"?`)) return
    await purge(resources.filter((r) => r.lesson_id === l.id))
    run(() => sb().from('lessons').delete().eq('id', l.id), 'Lección eliminada')
  }
  const setL = (l: Lesson, patch: Partial<Lesson>) => run(() => sb().from('lessons').update(patch).eq('id', l.id))
  const setYt = (l: Lesson, v: string) => {
    if (!v.trim()) return setL(l, { youtube_id: null })
    const y = ytId(v); if (!y) return toast('Enlace no válido. Pega una URL de YouTube', 'err')
    setL(l, { youtube_id: y }); toast('Video de YouTube vinculado')
  }

  /* ----- materiales ----- */
  const upload = async (l: Lesson, files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.size > 50 * 1024 * 1024) { toast(`${f.name} supera 50 MB`, 'err'); continue }
      const path = `${course.id}/${l.id}/${Date.now()}-${safeName(f.name)}`
      const up = await sb().storage.from('materials').upload(path, f)
      if (up.error) { toast(up.error.message, 'err'); continue }
      const { error: er } = await sb().from('lesson_resources').insert({ lesson_id: l.id, course_id: course.id, name: f.name, kind: kindFromName(f.name), storage_path: path })
      if (er) { await sb().storage.from('materials').remove([path]); toast(er.message, 'err') } else toast('Material subido: ' + f.name)
    }
    reload()
  }
  const delRes = async (r: Resource) => { await purge([r]); run(() => sb().from('lesson_resources').delete().eq('id', r.id)) }
  const addLink = async (l: Lesson, name: string, url: string) => {
    if (!/^https?:\/\//i.test(url)) return toast('El enlace debe empezar con http:// o https://', 'err')
    const { error: er } = await sb().from('lesson_resources').insert({ lesson_id: l.id, course_id: course.id, name: name.trim() || url, kind: 'link', url })
    if (er) return toast(er.message, 'err'); setLinkFor(null); toast('Enlace agregado'); reload()
  }

  const cat = cats.find((k) => k.id === course.category_id)
  return (
    <>
      <Link className="mu" to={base}>← {admin ? 'Cursos' : 'Mis cursos'}</Link>
      <div className="row sp">
        <h1>Editar curso <Badge s={course.status} label={COURSE_STATUS[course.status]} /></h1>
        <div className="row"><Link className="btn g" to={`/cursos/${course.slug}`}>Vista previa pública</Link><Link className="btn g" to={`/aula/${course.slug}`}>Vista previa del aula</Link></div>
      </div>

      {admin && form ? (
        <form className="card f" onSubmit={saveInfo}>
          <h3>Información, precio e imagen</h3>
          <div className="ed2">
            <img className="thumb" src={courseImg(course, cat?.icon)} alt="" />
            <div className="f"><Field label="Imagen de portada"><input type="file" accept="image/*" onChange={(e) => uploadCover(e.target.files?.[0])} /></Field>
              {course.cover_url && <button type="button" className="btn s g" onClick={() => run(() => sb().from('courses').update({ cover_url: null }).eq('id', course.id), 'Portada quitada')}>Quitar portada</button>}</div>
          </div>
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <div className="row">
            <Field label="Enlace (slug)"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></Field>
            <Field label="Categoría"><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Sin categoría</option>{cats.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
            <Field label="Nivel"><select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <div className="row">
            <Field label="Precio en Bs (0 = gratis)"><input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Duración (ej. 12 h)"><input value={form.duration_label} onChange={(e) => setForm({ ...form, duration_label: e.target.value })} /></Field>
            <Field label="Estado"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(COURSE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <label className="lb inline"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Curso destacado en la página principal</label>
          <Field label="Descripción corta"><textarea rows={2} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></Field>
          <Field label="Descripción completa"><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="row">
            <Field label="Objetivos de aprendizaje (uno por línea)"><textarea rows={4} value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></Field>
            <Field label="Requisitos (uno por línea)"><textarea rows={4} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></Field>
          </div>
          <Field label="Público objetivo"><textarea rows={2} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></Field>
          <div className="row"><button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar información'}</button></div>
        </form>
      ) : <div className="card mu">Solo el administrador puede editar la información comercial del curso. Aquí puedes gestionar los módulos, lecciones y materiales.</div>}

      {admin && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Instructores asignados</h3>
          {instructors.length === 0 ? <p className="mu">Aún no hay instructores. Créalos en la sección Instructores.</p> :
            <div className="row">{instructors.map((i) => <label key={i.id} className="lb inline"><input type="checkbox" checked={assigned.includes(i.id)} onChange={() => toggleInstructor(i.id)} />{i.full_name}</label>)}</div>}
        </div>
      )}

      <h3 style={{ marginTop: 22 }}>Contenido: módulos, videos de YouTube y materiales</h3>
      {modules.map((m, a) => {
        const ls = lessons.filter((l) => l.module_id === m.id).sort((x, y) => x.position - y.position)
        return (
          <div key={m.id} className="card mod">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <b style={{ whiteSpace: 'nowrap' }}>Módulo {a + 1}</b>
              <Editable value={m.title} onCommit={(v) => run(() => sb().from('modules').update({ title: v }).eq('id', m.id))} />
              <label className="lb inline" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={m.published} onChange={(e) => run(() => sb().from('modules').update({ published: e.target.checked }).eq('id', m.id))} />Publicado</label>
              <button className="btn s g" disabled={a === 0} onClick={() => swap('modules', modules, a, -1)} aria-label="Subir">↑</button>
              <button className="btn s g" disabled={a === modules.length - 1} onClick={() => swap('modules', modules, a, 1)} aria-label="Bajar">↓</button>
              <button className="btn s g" onClick={() => delModule(m)}>Eliminar</button>
            </div>
            {ls.map((l, b) => {
              const rs = resources.filter((r) => r.lesson_id === l.id)
              return (
                <div key={l.id} className="lsn">
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <Editable value={l.title} placeholder="Título de la lección" onCommit={(v) => setL(l, { title: v.trim() || l.title })} />
                    <button className="btn s g" disabled={b === 0} onClick={() => swap('lessons', ls, b, -1)} aria-label="Subir">↑</button>
                    <button className="btn s g" disabled={b === ls.length - 1} onClick={() => swap('lessons', ls, b, 1)} aria-label="Bajar">↓</button>
                    <button className="btn s g" onClick={() => delLesson(l)} title="Eliminar lección">✕</button>
                  </div>
                  <div className="row">
                    <Editable value={l.youtube_id ? `https://youtu.be/${l.youtube_id}` : ''} placeholder="Enlace de YouTube (https://youtu.be/...)" onCommit={(v) => setYt(l, v)} />
                    <Editable type="number" min={0} value={l.duration_min} style={{ maxWidth: 110 }} onCommit={(v) => setL(l, { duration_min: Math.max(0, parseInt(v) || 0) })} />
                    <span className="mu">min</span>
                  </div>
                  {l.youtube_id && <img src={`https://img.youtube.com/vi/${l.youtube_id}/mqdefault.jpg`} alt="Vista previa del video" style={{ width: 160, borderRadius: 8 }} />}
                  <Editable textarea rows={2} value={l.description} placeholder="Descripción breve" onCommit={(v) => setL(l, { description: v })} />
                  <Editable textarea rows={3} value={l.content} placeholder="Contenido complementario (texto)" onCommit={(v) => setL(l, { content: v })} />
                  <div className="row">
                    <label className="lb inline"><input type="checkbox" checked={l.required} onChange={(e) => setL(l, { required: e.target.checked })} />Obligatoria (cuenta para el certificado)</label>
                    <label className="lb inline"><input type="checkbox" checked={l.published} onChange={(e) => setL(l, { published: e.target.checked })} />Publicada</label>
                  </div>
                  <div className="row">
                    {rs.map((r) => <span key={r.id} className="tag">{r.kind === 'link' ? 'Enlace' : 'Archivo'}: {r.name} <a href="#" onClick={(e) => { e.preventDefault(); delRes(r) }} aria-label="Quitar">✕</a></span>)}
                    <label className="btn s g">+ Subir material<input hidden type="file" multiple onChange={(e) => { upload(l, e.target.files); e.target.value = '' }} /></label>
                    <button className="btn s g" onClick={() => setLinkFor(l)}>+ Enlace externo</button>
                  </div>
                </div>
              )
            })}
            <button className="btn s g" onClick={() => addLesson(m)}>+ Lección</button>
          </div>
        )
      })}
      <button className="btn g" onClick={addModule}>+ Agregar módulo</button>
      {linkFor && <LinkModal onClose={() => setLinkFor(null)} onSave={(n, u) => addLink(linkFor, n, u)} />}
    </>
  )
}

function LinkModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, url: string) => void }) {
  const [n, setN] = useState(''); const [u, setU] = useState('')
  return (
    <Modal title="Agregar enlace externo" onClose={onClose}>
      <form className="f" onSubmit={(e) => { e.preventDefault(); onSave(n, u) }}>
        <Field label="Nombre visible"><input value={n} onChange={(e) => setN(e.target.value)} placeholder="Guía en Google Drive" /></Field>
        <Field label="URL"><input value={u} onChange={(e) => setU(e.target.value)} placeholder="https://…" required /></Field>
        <button className="btn">Agregar</button>
      </form>
    </Modal>
  )
}
