import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Field, Logo } from '@/components/ui'
import { makeClient, normalizeUrl, saveConfig } from '@/lib/config'
import schemaSql from '../../../supabase/migrations/0001_schema.sql?raw'
import demoSql from '../../../supabase/demo_data.sql?raw'

/**
 * Asistente de instalación.
 *  1) Conectar  → URL + clave pública (anon / publishable).
 *  2) Base de datos → el navegador NO puede crear tablas con la clave pública (y no debe):
 *     se muestra un único script SQL para pegar y ejecutar en Supabase una sola vez.
 *     Ese script incluye un código de instalación de un solo uso.
 *  3) Administrador → se crea la cuenta y se reclama el rol con ese código (RPC segura).
 */
type Step = 'connect' | 'db' | 'admin' | 'done'
const STEPS: [Step, string][] = [['connect', '1 · Conectar'], ['db', '2 · Base de datos'], ['admin', '3 · Administrador'], ['done', 'Listo']]

const genCode = () => {
  const a = new Uint8Array(16); crypto.getRandomValues(a)
  return Array.from(a, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')
}

async function probe(c: SupabaseClient): Promise<'bad-connection' | 'bad-key' | 'no-schema' | 'no-admin' | 'ready'> {
  const { data, error } = await c.rpc('lms_status')
  if (error) {
    const m = `${error.code || ''} ${error.message || ''}`.toLowerCase()
    if (m.includes('pgrst202') || m.includes('could not find the function') || m.includes('42883')) return 'no-schema'
    if (m.includes('invalid api key') || m.includes('jwt')) return 'bad-key'
    return 'bad-connection'
  }
  return data?.has_admin ? 'ready' : 'no-admin'
}

export default function Install() {
  const [step, setStep] = useState<Step>('connect')
  const [url, setUrl] = useState(''); const [key, setKey] = useState('')
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [msg, setMsg] = useState<{ k: 'err' | 'ok'; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState(true)
  const [copied, setCopied] = useState(false)
  const [admin, setAdmin] = useState({ name: '', email: '', pw: '', pw2: '' })
  const [pendingConfirm, setPendingConfirm] = useState(false)

  const code = useMemo(() => {
    const k = 'lms.setupcode'; let c = sessionStorage.getItem(k)
    if (!c) { c = genCode(); sessionStorage.setItem(k, c) }
    return c
  }, [])
  const sql = useMemo(() => `${schemaSql}\n${demo ? '\n' + demoSql + '\n' : ''}\n-- Código de instalación de un solo uso (permite crear el primer administrador)\nselect private.set_setup_code('${code}');\n`, [demo, code])
  const ref = (() => { try { const h = new URL(normalizeUrl(url)).hostname; return h.endsWith('.supabase.co') ? h.split('.')[0] : '' } catch { return '' } })()
  const editorUrl = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : 'https://supabase.com/dashboard'

  useEffect(() => { document.title = 'Instalación · Aula Norte LMS' }, [])

  const connect = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    if (!/^https:\/\/.+\..+/.test(url.trim())) return setMsg({ k: 'err', t: 'La URL debe empezar con https:// (por ejemplo https://abcd1234.supabase.co).' })
    if (key.trim().length < 20) return setMsg({ k: 'err', t: 'La clave parece incompleta. Copia la "anon / publishable key" completa.' })
    if (/service_role/i.test(key) || key.trim().startsWith('sb_secret_') || tryRole(key) === 'service_role') return setMsg({ k: 'err', t: 'Esa es la clave SECRETA (service_role). Nunca la pegues aquí. Usa la clave pública (anon / publishable).' })
    setBusy(true)
    try {
      const c = makeClient({ url, key }); setClient(c)
      const r = await probe(c)
      if (r === 'bad-connection') setMsg({ k: 'err', t: 'No pudimos conectar. Revisa que la URL sea correcta y que el proyecto esté activo.' })
      else if (r === 'bad-key') setMsg({ k: 'err', t: 'La clave pública no es válida para este proyecto. Revísala en Project Settings → API.' })
      else if (r === 'ready') { saveConfig({ url: normalizeUrl(url), key: key.trim() }); window.location.assign('/') }
      else if (r === 'no-admin') { setMsg({ k: 'ok', t: 'Conexión correcta. La base de datos ya está preparada.' }); setStep('admin') }
      else { setMsg({ k: 'ok', t: 'Conexión correcta. Falta preparar la base de datos.' }); setStep('db') }
    } catch { setMsg({ k: 'err', t: 'Ocurrió un error inesperado al conectar.' }) }
    setBusy(false)
  }

  const copy = async () => { await navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2500) }

  const verifyDb = async () => {
    if (!client) return; setBusy(true); setMsg(null)
    const r = await probe(client)
    if (r === 'no-schema') setMsg({ k: 'err', t: 'Todavía no vemos la base de datos preparada. Pega el script completo en el SQL Editor y pulsa "Run".' })
    else if (r === 'ready') { saveConfig({ url: normalizeUrl(url), key: key.trim() }); window.location.assign('/') }
    else if (r === 'no-admin') { setMsg({ k: 'ok', t: 'Base de datos lista.' }); setStep('admin') }
    else setMsg({ k: 'err', t: 'No pudimos verificar la conexión. Inténtalo de nuevo.' })
    setBusy(false)
  }

  const claim = async (c: SupabaseClient) => {
    const { error } = await c.rpc('claim_first_admin', { p_code: code })
    if (error) throw new Error(error.message.includes('Código') ? 'El código de instalación no coincide. Vuelve al paso 2 y ejecuta el script con esta misma pantalla abierta (o usa la opción "perdí el código" de abajo).' : error.message)
    saveConfig({ url: normalizeUrl(url), key: key.trim() })
    sessionStorage.removeItem('lms.setupcode')
    setStep('done')
  }

  const createAdmin = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); if (!client) return
    if (admin.name.trim().length < 3) return setMsg({ k: 'err', t: 'Escribe tu nombre completo.' })
    if (!/^\S+@\S+\.\S+$/.test(admin.email)) return setMsg({ k: 'err', t: 'El correo no es válido.' })
    if (admin.pw.length < 8) return setMsg({ k: 'err', t: 'La contraseña debe tener al menos 8 caracteres.' })
    if (admin.pw !== admin.pw2) return setMsg({ k: 'err', t: 'Las contraseñas no coinciden.' })
    setBusy(true)
    try {
      let { data, error } = await client.auth.signUp({ email: admin.email.trim(), password: admin.pw, options: { data: { full_name: admin.name.trim() } } })
      if (error && /already/i.test(error.message)) {
        const r = await client.auth.signInWithPassword({ email: admin.email.trim(), password: admin.pw })
        if (r.error) throw new Error('Ese correo ya existe con otra contraseña.')
        data = { user: r.data.user, session: r.data.session }; error = null
      }
      if (error) throw new Error(error.message)
      if (!data.session) { setPendingConfirm(true); setMsg({ k: 'ok', t: 'Cuenta creada. Tu proyecto pide confirmar el correo: abre el mensaje que te enviamos y luego pulsa "Ya confirmé mi correo".' }) }
      else await claim(client)
    } catch (x) { setMsg({ k: 'err', t: (x as Error).message }) }
    setBusy(false)
  }

  const afterConfirm = async () => {
    if (!client) return; setBusy(true); setMsg(null)
    try {
      const r = await client.auth.signInWithPassword({ email: admin.email.trim(), password: admin.pw })
      if (r.error) throw new Error('Aún no podemos ingresar. ¿Confirmaste el correo?')
      await claim(client)
    } catch (x) { setMsg({ k: 'err', t: (x as Error).message }) }
    setBusy(false)
  }

  const idx = STEPS.findIndex((s) => s[0] === step)
  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="fb" style={{ marginBottom: 18, color: 'var(--hd)' }}><Logo size={34} />Instalación de la plataforma</div>
      <div className="steps-i">{STEPS.map(([k, l], i) => <span key={k} className={i === idx ? 'on' : i < idx ? 'done' : ''}>{l}</span>)}</div>
      {msg && <div className={'card ' + (msg.k === 'err' ? 'err' : 'okmsg')} role="alert" style={{ marginBottom: 14 }}>{msg.t}</div>}

      {step === 'connect' && (
        <form className="card f" onSubmit={connect}>
          <h2>Conecta tu proyecto de Supabase</h2>
          <p className="mu">Los dos datos están en tu proyecto, en <b>Project Settings → API</b>. Solo se usa la clave <b>pública</b>.</p>
          <Field label="Project URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd1234.supabase.co" required autoComplete="off" /></Field>
          <Field label="Publishable / anon key"><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ… o sb_publishable_…" required autoComplete="off" /></Field>
          <button className="btn" disabled={busy}>{busy ? 'Comprobando…' : 'Comprobar conexión'}</button>
        </form>
      )}

      {step === 'db' && (
        <div className="card f">
          <h2>Prepara la base de datos (una sola vez)</h2>
          <p className="mu">Por seguridad, un navegador no puede crear tablas con una clave pública. Hazlo así, son 30 segundos:</p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Pulsa <b>Copiar script</b>.</li>
            <li>Abre el <a style={{ textDecoration: 'underline' }} href={editorUrl} target="_blank" rel="noopener noreferrer">SQL Editor de tu proyecto</a>, pega y pulsa <b>Run</b>.</li>
            <li>Vuelve aquí y pulsa <b>Ya lo ejecuté</b>.</li>
          </ol>
          <label className="lb inline"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Incluir 6 cursos de ejemplo (puedes borrarlos después)</label>
          <pre className="sql">{sql.slice(0, 700)}…{'\n'}(script completo de {sql.split('\n').length} líneas · se copia entero con el botón)</pre>
          <div className="row">
            <button className="btn" onClick={copy}>{copied ? 'Copiado' : 'Copiar script'}</button>
            <a className="btn g" href={editorUrl} target="_blank" rel="noopener noreferrer">Abrir SQL Editor</a>
            <button className="btn" disabled={busy} onClick={verifyDb}>{busy ? 'Verificando…' : 'Ya lo ejecuté'}</button>
          </div>
        </div>
      )}

      {step === 'admin' && (
        <form className="card f" onSubmit={createAdmin}>
          <h2>Crea el administrador</h2>
          <Field label="Nombre completo"><input value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} required /></Field>
          <Field label="Correo"><input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} required autoComplete="email" /></Field>
          <div className="row">
            <Field label="Contraseña"><input type="password" value={admin.pw} onChange={(e) => setAdmin({ ...admin, pw: e.target.value })} required autoComplete="new-password" /></Field>
            <Field label="Confirmación"><input type="password" value={admin.pw2} onChange={(e) => setAdmin({ ...admin, pw2: e.target.value })} required autoComplete="new-password" /></Field>
          </div>
          {pendingConfirm
            ? <button type="button" className="btn" disabled={busy} onClick={afterConfirm}>Ya confirmé mi correo</button>
            : <button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Crear administrador y finalizar'}</button>}
          <details><summary className="mu" style={{ cursor: 'pointer' }}>Perdí el código de instalación / recargué la página</summary>
            <p className="mu">Ejecuta esta línea en el SQL Editor y vuelve a intentarlo (solo funciona mientras no exista un administrador):</p>
            <pre className="sql">select private.set_setup_code('{code}');</pre>
          </details>
        </form>
      )}

      {step === 'done' && (
        <div className="card f">
          <h2>¡Plataforma instalada!</h2>
          <p>Tu cuenta de administrador está lista y la base de datos está protegida con permisos por rol.</p>
          <div className="card" style={{ background: 'var(--bg)' }}>
            <b>Un último paso para publicar tu sitio</b>
            <p className="mu">Esta configuración quedó guardada en <b>este navegador</b>. Para que tus visitantes también vean la academia, define estas variables en tu hosting (o copia los valores en <code>public/config.js</code>) y vuelve a publicar:</p>
            <pre className="sql">{`VITE_SUPABASE_URL=${normalizeUrl(url)}\nVITE_SUPABASE_ANON_KEY=${key.trim()}`}</pre>
          </div>
          <button className="btn" onClick={() => window.location.assign('/admin')}>Ir al panel de administración</button>
        </div>
      )}
    </div>
  )
}

function tryRole(jwt: string): string | null {
  try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role ?? null } catch { return null }
}
