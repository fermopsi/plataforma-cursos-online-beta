import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, ErrorBox, Field, Loading, Modal, courseImg, useToast } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import type { Category, Course } from '@/lib/types'
import { COURSE_STATUS, money, slugify } from '@/lib/utils'

export function AdminCourses() {
  const { profile } = useAuth()
  const toast = useToast(); const nav = useNavigate()
  const [newOpen, setNewOpen] = useState(false)
  const [f, setF] = useState({ title: '', price: '0', category_id: '' })
  const [q, setQ] = useState(''); const [st, setSt] = useState('all')
  const { data, loading, error, reload } = useAsync(async () => {
    const [c, k] = await Promise.all([sb().from('courses').select('*').order('created_at', { ascending: false }), sb().from('categories').select('*').order('position')])
    return { courses: must<Course[]>(c), cats: must<Category[]>(k) }
  }, [])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />

  const setStatus = async (c: Course, status: string) => {
    const { error: e } = await sb().from('courses').update({ status }).eq('id', c.id)
    e ? toast(e.message, 'err') : (toast('Estado actualizado'), reload())
  }
  const dup = async (c: Course) => {
    try { must(await sb().rpc('duplicate_course', { p_course: c.id })); toast('Curso duplicado como borrador'); reload() } catch (e) { toast((e as Error).message, 'err') }
  }
  const create = async (e: FormEvent) => {
    e.preventDefault()
    const slug = `${slugify(f.title) || 'curso'}-${Math.random().toString(36).slice(2, 6)}`
    const { data: row, error: er } = await sb().from('courses').insert({
      title: f.title.trim(), slug, price: Math.max(0, +f.price || 0), category_id: f.category_id || null, status: 'draft', created_by: profile!.id,
    }).select('id').single()
    if (er) return toast(er.message, 'err')
    toast('Curso creado como borrador'); nav(`/admin/cursos/${row.id}`)
  }
  const list = data.courses.filter((c) => (st === 'all' || c.status === st) && c.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row sp"><h1>Cursos</h1><button className="btn" onClick={() => setNewOpen(true)}>Nuevo curso</button></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Buscar curso" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="all">Todos los estados</option>{Object.entries(COURSE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="card tw"><table><thead><tr><th>Curso</th><th>Categoría</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>
        {list.map((c) => {
          const cat = data.cats.find((k) => k.id === c.category_id)
          return (
            <tr key={c.id}>
              <td><div className="row" style={{ flexWrap: 'nowrap' }}><img className="th" src={courseImg(c, cat?.icon)} alt="" />{c.title}</div></td>
              <td>{cat?.name ?? '—'}</td><td>{money(c.price, c.currency)}</td><td><Badge s={c.status} label={COURSE_STATUS[c.status]} /></td>
              <td><div className="row">
                <Link className="btn s" to={`/admin/cursos/${c.id}`}>Editar</Link>
                <Link className="btn s g" to={`/cursos/${c.slug}`}>Ver</Link>
                {c.status !== 'published' ? <button className="btn s g" onClick={() => setStatus(c, 'published')}>Publicar</button> : <button className="btn s g" onClick={() => setStatus(c, 'draft')}>Despublicar</button>}
                {c.status !== 'archived' && <button className="btn s g" onClick={() => setStatus(c, 'archived')}>Archivar</button>}
                <button className="btn s g" onClick={() => dup(c)}>Duplicar</button>
              </div></td>
            </tr>
          )
        })}</tbody></table>{list.length === 0 && <p className="mu">No hay cursos con ese filtro.</p>}</div>
      {newOpen && (
        <Modal title="Nuevo curso" onClose={() => setNewOpen(false)}>
          <form className="f" onSubmit={create}>
            <Field label="Título"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={3} autoFocus /></Field>
            <Field label="Categoría"><select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}><option value="">Sin categoría</option>{data.cats.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
            <Field label="Precio en Bs (0 = gratis)"><input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <button className="btn">Crear y editar contenido</button>
          </form>
        </Modal>
      )}
    </>
  )
}
