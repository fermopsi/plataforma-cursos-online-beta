import { Link } from 'react-router-dom'
import { CourseCard } from '@/components/CourseCard'
import { ErrorBox, Icon, Loading, courseImg } from '@/components/ui'
import { useCatalog } from '@/lib/hooks'
import { useSettings } from '@/lib/settings'

export default function Home() {
  const { settings: s } = useSettings()
  const { data, loading, error } = useCatalog()
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || 'Sin datos'} />
  const { courses, categories } = data
  const feat = courses.filter((c) => c.featured)
  const featured = (feat.length ? feat : courses).slice(0, 3)
  const hero = featured[0]
  return (
    <>
      <section className="h2">
        <div className="wrap hh">
          <div>
            <span className="eyebrow">{s.tagline}</span>
            <h1>{s.hero_title}</h1>
            <p className="lead">{s.hero_subtitle}</p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link className="btn big" to="/cursos">Explorar cursos</Link>
              <Link className="btn g big" to="/nosotros">Conocer {s.academy_name}</Link>
            </div>
          </div>
          <div className="himg"><img src={hero ? courseImg(hero, hero.category?.icon) : courseImg({ cover_url: null, title: s.academy_name })} alt="Portada de curso en línea" /></div>
        </div>
      </section>
      <div className="wrap">
        <h2>Categorías de formación</h2>
        <div className="grid cats">
          {categories.map((k) => (
            <Link key={k.id} className="card cat" to={`/cursos?cat=${k.slug}`}>
              <Icon name={k.icon} size={28} /><b>{k.name}</b>
              <span className="mu">{courses.filter((c) => c.category_id === k.id).length} curso(s)</span>
            </Link>
          ))}
        </div>

        <h2 style={{ marginTop: 40 }}>Cursos destacados</h2>
        {featured.length ? <div className="grid">{featured.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          : <div className="card mu">Pronto publicaremos nuevos cursos.</div>}

        <h2 style={{ marginTop: 40 }}>Por qué estudiar en {s.academy_name}</h2>
        <div className="grid">
          {[['Pago único', 'Pagas una vez y conservas el acceso a tu curso.'],
            ['Certificado con código', 'Se emite al terminar las lecciones obligatorias.'],
            ['Aprende a tu ritmo', 'Retoma en la última lección que viste, desde cualquier dispositivo.']].map(([t, d]) => (
            <div key={t} className="card ben"><Icon name="ok" /><b>{t}</b><p className="mu" style={{ margin: 0 }}>{d}</p></div>
          ))}
        </div>

        <h2 style={{ marginTop: 40 }}>Cómo funciona la inscripción</h2>
        <div className="grid steps">
          {['Elige tu curso en el catálogo.', 'Escríbenos por WhatsApp desde la ficha del curso.', 'Confirmamos tu pago y habilitamos tu acceso.', 'Ingresa al aula y comienza a aprender.'].map((t, i) => (
            <div key={i} className="card"><span className="num">{i + 1}</span><p>{t}</p></div>
          ))}
        </div>

        <h2 style={{ marginTop: 40 }}>Preguntas frecuentes</h2>
        <div className="card">
          <details><summary><b>¿Cómo me inscribo?</b></summary><p className="mu">Escríbenos por WhatsApp, registra tu pago y habilitamos tu acceso.</p></details>
          <hr className="sep" />
          <details><summary><b>¿Qué métodos de pago aceptan?</b></summary><p className="mu">Efectivo, transferencia bancaria y QR.</p></details>
          <hr className="sep" />
          <details><summary><b>¿Cómo obtengo mi certificado?</b></summary><p className="mu">Al completar todas las lecciones obligatorias del curso, el certificado se genera automáticamente y puedes descargarlo en PDF.</p></details>
        </div>
      </div>
    </>
  )
}
