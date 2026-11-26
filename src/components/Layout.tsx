import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'
import { homeFor, useAuth } from '@/lib/auth'
import { useSettings } from '@/lib/settings'
import type { Role } from '@/lib/types'
import { Loading, Logo } from './ui'

export function TopNav() {
  const { profile, signOut } = useAuth()
  const { settings } = useSettings()
  const L: [string, string][] = [['/', 'Inicio'], ['/cursos', 'Cursos'], ['/nosotros', 'Nosotros'], ['/contacto', 'Contacto']]
  const cls = ({ isActive }: { isActive: boolean }) => 'nl' + (isActive ? ' active' : '')
  return (
    <nav className="top" aria-label="Principal">
      <Link to="/" className="brand"><Logo />{settings.academy_name}</Link>
      {L.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={cls}>{label}</NavLink>)}
      {profile ? (
        <>
          <NavLink to={homeFor(profile.role)} className="nl cta">{profile.role === 'student' ? 'Mi aula' : profile.role === 'admin' ? 'Panel' : 'Panel instructor'}</NavLink>
          <button className="nl" onClick={signOut}>Salir</button>
        </>
      ) : <NavLink to="/ingresar" className="nl cta">Ingresar al aula</NavLink>}
    </nav>
  )
}

export function Footer() {
  const { settings: s } = useSettings()
  return (
    <footer className="foot">
      <div className="in">
        <div><b><Logo />{s.academy_name}</b><p>{s.tagline}</p></div>
        <div><b>Cursos</b><Link to="/cursos">Catálogo</Link><Link to="/verificar">Verificar certificado</Link></div>
        <div><b>Contacto</b><a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          {s.contact_email && <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a>}
          {s.instagram && <a href={s.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
          {s.facebook && <a href={s.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}</div>
      </div>
      <div className="in cp">© {new Date().getFullYear()} {s.academy_name}</div>
    </footer>
  )
}

export function PublicLayout() { return <><TopNav /><Outlet /><Footer /></> }
export function BareLayout() { return <><TopNav /><Outlet /></> }

export function AdminLayout() {
  const L: [string, string, boolean?][] = [['/admin', 'Resumen', true], ['/admin/cursos', 'Cursos'], ['/admin/estudiantes', 'Estudiantes'], ['/admin/instructores', 'Instructores'],
    ['/admin/categorias', 'Categorías'], ['/admin/pagos', 'Inscripciones y pagos'], ['/admin/reportes', 'Reportes'], ['/admin/configuracion', 'Configuración']]
  return (
    <>
      <TopNav />
      <div className="wrap adm">
        <div className="side">{L.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>)}</div>
        <div><Outlet /></div>
      </div>
    </>
  )
}

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <><TopNav /><Loading /></>
  if (!session) return <Navigate to="/ingresar" state={{ from: loc.pathname }} replace />
  if (!profile) return <><TopNav /><Loading text="Preparando tu cuenta…" /></>
  if (!profile.active) return <><TopNav /><div className="wrap narrow"><div className="card"><h2>Acceso suspendido</h2><p className="mu">Tu cuenta está suspendida. Escribe a la academia para reactivarla.</p></div></div></>
  if (roles && !roles.includes(profile.role)) return <Navigate to={homeFor(profile.role)} replace />
  return <>{children}</>
}
