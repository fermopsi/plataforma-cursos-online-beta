import { Link } from 'react-router-dom'
import { LEVELS, money } from '@/lib/utils'
import type { CatalogCourse } from '@/lib/types'
import { courseImg } from './ui'

export function CourseCard({ c }: { c: CatalogCourse }) {
  return (
    <Link to={`/cursos/${c.slug}`} className="card cc">
      <div className="cov">
        <img alt={`Portada de ${c.title}`} loading="lazy" src={courseImg(c, c.category?.icon)} />
        {c.price === 0 && <span className="tag free" style={{ position: 'absolute', top: 10, left: 10 }}>Gratis</span>}
      </div>
      <div className="in">
        {c.category && <span className="tag" style={{ alignSelf: 'flex-start' }}>{c.category.name}</span>}
        <h3 style={{ marginTop: 8 }}>{c.title}</h3>
        <div className="mu">{[c.instructors[0]?.full_name, LEVELS[c.level], c.duration_label].filter(Boolean).join(' · ')}</div>
        <p className="mu">{c.short_description}</p>
        <div className="row sp" style={{ marginTop: 'auto', paddingTop: 10 }}><b>{money(c.price, c.currency)}</b><span className="btn s">Ver curso</span></div>
      </div>
    </Link>
  )
}
