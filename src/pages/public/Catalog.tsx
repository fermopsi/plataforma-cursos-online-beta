import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CourseCard } from '@/components/CourseCard'
import { ErrorBox, Loading } from '@/components/ui'
import { useCatalog } from '@/lib/hooks'
import { LEVELS } from '@/lib/utils'

export default function Catalog() {
  const { data, loading, error } = useCatalog()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(params.get('cat') || 'all')
  const [lv, setLv] = useState('all')
  const [ins, setIns] = useState('all')
  const [sort, setSort] = useState('recent')

  const list = useMemo(() => {
    if (!data) return []
    const l = data.courses.filter((c) =>
      (cat === 'all' || c.category?.slug === cat) && (lv === 'all' || c.level === lv) &&
      (ins === 'all' || c.instructors.some((i) => i.id === ins)) &&
      (c.title + ' ' + c.short_description).toLowerCase().includes(q.toLowerCase()))
    if (sort === 'price-asc') l.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') l.sort((a, b) => b.price - a.price)
    if (sort === 'title') l.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'featured') l.sort((a, b) => Number(b.featured) - Number(a.featured))
    return l
  }, [data, q, cat, lv, ins, sort])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || 'Sin datos'} />
  return (
    <div className="wrap">
      <h1>Catálogo de cursos</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <input placeholder="Buscar curso" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar curso" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
          <option value="all">Todas las categorías</option>
          {data.categories.map((k) => <option key={k.id} value={k.slug}>{k.name}</option>)}
        </select>
        <select value={lv} onChange={(e) => setLv(e.target.value)} aria-label="Nivel">
          <option value="all">Todos los niveles</option>
          {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={ins} onChange={(e) => setIns(e.target.value)} aria-label="Instructor">
          <option value="all">Todos los instructores</option>
          {data.instructors.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
          <option value="recent">Más recientes</option><option value="featured">Destacados</option>
          <option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option>
          <option value="title">Nombre A–Z</option>
        </select>
      </div>
      {list.length ? <div className="grid">{list.map((c) => <CourseCard key={c.id} c={c} />)}</div>
        : <div className="card">Ningún curso coincide. Prueba con otra categoría o nivel.</div>}
    </div>
  )
}
