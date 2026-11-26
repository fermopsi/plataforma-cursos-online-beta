import { FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CertificateView } from '@/components/Certificate'
import { Field } from '@/components/ui'
import { sb } from '@/lib/config'
import { useSettings } from '@/lib/settings'

export function About() {
  const { settings: s } = useSettings()
  return (
    <div className="wrap narrow">
      <h1>Conoce {s.academy_name}</h1>
      <p className="lead">{s.description}</p>
      <Link className="btn" to="/cursos">Ver cursos</Link>
    </div>
  )
}

export function Contact() {
  const { settings: s } = useSettings()
  return (
    <div className="wrap narrow">
      <h1>Contacto</h1>
      <p className="lead">Escríbenos por WhatsApp para inscribirte o resolver tus dudas.</p>
      <div className="row">
        <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${s.whatsapp}`}>Escribir por WhatsApp</a>
        {s.contact_email && <a className="btn g" href={`mailto:${s.contact_email}`}>{s.contact_email}</a>}
      </div>
    </div>
  )
}

/** Verificación pública de certificados por código. */
export function Verify() {
  const { code: p } = useParams()
  const nav = useNavigate()
  const [code, setCode] = useState(p || '')
  const [res, setRes] = useState<{ student_name: string; course_title: string; issued_at: string; revoked: boolean } | null | 'none'>(null)
  const [busy, setBusy] = useState(false)
  const { settings } = useSettings()

  const check = async (e?: FormEvent) => {
    e?.preventDefault(); if (!code.trim()) return
    setBusy(true)
    const { data } = await sb().rpc('verify_certificate', { p_code: code })
    setRes(data && data.length ? data[0] : 'none'); setBusy(false)
    nav(`/verificar/${encodeURIComponent(code.trim())}`, { replace: true })
  }
  return (
    <div className="wrap narrow">
      <h1>Verificar certificado</h1>
      <p className="lead">Ingresa el código que aparece en el certificado.</p>
      <form className="row" onSubmit={check}><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ANL-2026-XXXXXXXX" aria-label="Código" /><button className="btn" disabled={busy}>Verificar</button></form>
      <div style={{ marginTop: 16 }}>
        {res === 'none' && <div className="card err">No encontramos un certificado con ese código.</div>}
        {res && res !== 'none' && (res.revoked ? <div className="card err">Este certificado fue revocado.</div>
          : <><div className="okmsg" style={{ marginBottom: 8 }}>Certificado válido emitido por {settings.academy_name}</div>
            <CertificateView cert={{ student: res.student_name, course: res.course_title, date: res.issued_at, code }} /></>)}
      </div>
    </div>
  )
}

export { Field }
