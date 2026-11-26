import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Field, Logo, useToast } from '@/components/ui'
import { homeFor, useAuth } from '@/lib/auth'
import { sb } from '@/lib/config'
import { useSettings } from '@/lib/settings'

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const { settings: s } = useSettings()
  return (
    <div className="lg">
      <div className="lp"><b className="fb"><Logo />{s.academy_name}</b><div><h1>{title}</h1><p>{sub}</p></div><span className="mu" style={{ color: '#94a3b8' }}>{s.tagline}</span></div>
      <div className="lf">{children}</div>
    </div>
  )
}

export function Login() {
  const { signIn, profile, session } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  if (session && profile) return <Navigate to={from || homeFor(profile.role)} replace />
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await signIn(email, pw) } catch (x) { setErr((x as Error).message); setBusy(false) }
    // La redirección ocurre arriba cuando el perfil termina de cargar.
    void nav
  }
  return (
    <Shell title="Bienvenido de nuevo" sub="Ingresa a tu aula y continúa donde lo dejaste.">
      <form className="f" onSubmit={submit}>
        <h2>Ingresar al aula</h2>
        <Field label="Correo electrónico"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Contraseña"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
        {err && <div className="err" role="alert">{err}</div>}
        <Link className="mu" to="/recuperar">¿Olvidaste tu contraseña?</Link>
        <button className="btn" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <span className="mu">¿Aún no tienes cuenta? <Link to="/registro" style={{ textDecoration: 'underline' }}>Regístrate</Link></span>
      </form>
    </Shell>
  )
}

export function Register() {
  const { signUp, session, profile } = useAuth()
  const [f, setF] = useState({ name: '', email: '', phone: '', pw: '', pw2: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)
  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    if (f.name.trim().length < 3) return setErr('Escribe tu nombre completo')
    if (f.pw.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres')
    if (f.pw !== f.pw2) return setErr('Las contraseñas no coinciden')
    setBusy(true)
    try { const r = await signUp(f.email, f.pw, f.name, f.phone); if (r.needsConfirm) setDone(true) } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <Shell title="Crea tu cuenta" sub="Regístrate para acceder a tus cursos, materiales y certificados.">
      {done ? <div className="f"><h2>Revisa tu correo</h2><p className="mu">Te enviamos un enlace para confirmar tu cuenta. Después podrás ingresar.</p><Link className="btn" to="/ingresar">Ir a ingresar</Link></div> : (
        <form className="f" onSubmit={submit}>
          <h2>Registro</h2>
          <Field label="Nombre completo"><input value={f.name} onChange={set('name')} required autoComplete="name" /></Field>
          <Field label="Correo electrónico"><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></Field>
          <Field label="Teléfono (opcional)"><input value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
          <Field label="Contraseña"><input type="password" value={f.pw} onChange={set('pw')} required autoComplete="new-password" /></Field>
          <Field label="Repite la contraseña"><input type="password" value={f.pw2} onChange={set('pw2')} required autoComplete="new-password" /></Field>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
          <span className="mu">¿Ya tienes cuenta? <Link to="/ingresar" style={{ textDecoration: 'underline' }}>Ingresa</Link></span>
        </form>)}
    </Shell>
  )
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/restablecer` })
    if (error) setErr(error.message); else setSent(true)
  }
  return (
    <Shell title="Recupera tu acceso" sub="Te enviaremos un enlace para crear una contraseña nueva.">
      {sent ? <div className="f"><h2>Listo</h2><p className="mu">Si el correo existe, recibirás un enlace para restablecer tu contraseña.</p><Link className="btn" to="/ingresar">Volver</Link></div> : (
        <form className="f" onSubmit={submit}>
          <h2>Recuperar contraseña</h2>
          <Field label="Correo electrónico"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          {err && <div className="err">{err}</div>}
          <button className="btn">Enviar enlace</button><Link className="mu" to="/ingresar">Volver a ingresar</Link>
        </form>)}
    </Shell>
  )
}

export function Reset() {
  const nav = useNavigate(); const toast = useToast()
  const [ready, setReady] = useState(false); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [err, setErr] = useState('')
  useEffect(() => {
    const { data } = sb().auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN') setReady(true) })
    sb().auth.getSession().then(({ data: d }) => d.session && setReady(true))
    return () => data.subscription.unsubscribe()
  }, [])
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Mínimo 8 caracteres')
    if (pw !== pw2) return setErr('Las contraseñas no coinciden')
    const { error } = await sb().auth.updateUser({ password: pw })
    if (error) return setErr(error.message)
    toast('Contraseña actualizada'); nav('/estudiante')
  }
  return (
    <Shell title="Nueva contraseña" sub="Elige una contraseña segura para tu cuenta.">
      {!ready ? <div className="f"><p className="mu">Abre esta página desde el enlace que te enviamos por correo.</p><Link className="btn" to="/recuperar">Pedir otro enlace</Link></div> : (
        <form className="f" onSubmit={submit}>
          <h2>Restablecer contraseña</h2>
          <Field label="Nueva contraseña"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" /></Field>
          <Field label="Repite la contraseña"><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" /></Field>
          {err && <div className="err">{err}</div>}<button className="btn">Guardar contraseña</button>
        </form>)}
    </Shell>
  )
}
