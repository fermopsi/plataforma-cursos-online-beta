import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { CertificateModal, CertData, downloadCertificatePdf } from '@/components/Certificate'
import { Empty, ErrorBox, Field, Loading, useToast } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { must, sb } from '@/lib/config'
import { useAsync } from '@/lib/hooks'
import { useSettings } from '@/lib/settings'
import type { Certificate, Course } from '@/lib/types'
import { fmtDate, safeName } from '@/lib/utils'

export function StudentCertificates() {
  const { profile } = useAuth()
  const { settings } = useSettings()
  const [view, setView] = useState<CertData | null>(null)
  const { data, loading, error } = useAsync(async () => {
    const [c, k] = await Promise.all([
      sb().from('certificates').select('*').eq('student_id', profile!.id).order('issued_at', { ascending: false }),
      sb().from('courses').select('id,title'),
    ])
    return { certs: must<Certificate[]>(c), courses: must<Pick<Course, 'id' | 'title'>[]>(k) }
  }, [profile?.id])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox msg={error || ''} />
  const mk = (c: Certificate): CertData => ({ student: profile!.full_name, course: data.courses.find((x) => x.id === c.course_id)?.title ?? 'Curso', date: c.issued_at, code: c.code })
  return (
    <div className="wrap">
      <Link className="mu" to="/estudiante">← Mis cursos</Link>
      <h1>Mis certificados</h1>
      {data.certs.length === 0 ? <Empty>Cuando completes todas las lecciones obligatorias de un curso, tu certificado aparecerá aquí.</Empty> : (
        <div className="card tw"><table><thead><tr><th>Curso</th><th>Emitido</th><th>Código</th><th></th></tr></thead><tbody>
          {data.certs.map((c) => (
            <tr key={c.id}><td>{mk(c).course}</td><td>{fmtDate(c.issued_at)}</td><td>{c.code}{c.revoked && <span className="st revoked" style={{ marginLeft: 6 }}>Revocado</span>}</td>
              <td className="row">{!c.revoked && <><button className="btn s g" onClick={() => setView(mk(c))}>Ver</button><button className="btn s" onClick={() => downloadCertificatePdf(mk(c), settings)}>PDF</button></>}</td></tr>
          ))}</tbody></table></div>
      )}
      {view && <CertificateModal cert={view} onClose={() => setView(null)} />}
    </div>
  )
}

export function StudentProfile() {
  const { profile, refresh } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ full_name: profile!.full_name, phone: profile!.phone ?? '' })
  const [pw, setPw] = useState({ a: '', b: '' })
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    const { error } = await sb().from('profiles').update({ full_name: f.full_name.trim(), phone: f.phone.trim() || null }).eq('id', profile!.id)
    setBusy(false); if (error) return toast(error.message, 'err'); await refresh(); toast('Perfil actualizado')
  }
  const avatar = async (file?: File) => {
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return toast('La imagen debe pesar menos de 3 MB', 'err')
    const path = `${profile!.id}/${Date.now()}-${safeName(file.name)}`
    const up = await sb().storage.from('avatars').upload(path, file, { upsert: true })
    if (up.error) return toast(up.error.message, 'err')
    const url = sb().storage.from('avatars').getPublicUrl(path).data.publicUrl
    const { error } = await sb().from('profiles').update({ avatar_url: url }).eq('id', profile!.id)
    if (error) return toast(error.message, 'err'); await refresh(); toast('Foto actualizada')
  }
  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.a.length < 8) return toast('Mínimo 8 caracteres', 'err')
    if (pw.a !== pw.b) return toast('Las contraseñas no coinciden', 'err')
    const { error } = await sb().auth.updateUser({ password: pw.a })
    if (error) return toast(error.message, 'err'); setPw({ a: '', b: '' }); toast('Contraseña actualizada')
  }
  return (
    <div className="wrap narrow">
      <Link className="mu" to="/estudiante">← Mis cursos</Link>
      <h1>Mi perfil</h1>
      <form className="card f" onSubmit={save}>
        <div className="row">
          {profile!.avatar_url ? <img className="avatar" src={profile!.avatar_url} alt="" /> : <span className="avatar num" style={{ borderRadius: '50%', fontSize: 28 }}>{profile!.full_name[0]}</span>}
          <Field label="Foto de perfil"><input type="file" accept="image/*" onChange={(e) => avatar(e.target.files?.[0])} /></Field>
        </div>
        <Field label="Nombre completo"><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required minLength={3} /></Field>
        <Field label="Correo (no editable)"><input value={profile!.email} disabled /></Field>
        <Field label="Teléfono"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <button className="btn" disabled={busy}>Guardar cambios</button>
      </form>
      <form className="card f" style={{ marginTop: 16 }} onSubmit={changePw}>
        <h3>Cambiar contraseña</h3>
        <Field label="Nueva contraseña"><input type="password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoComplete="new-password" /></Field>
        <Field label="Repite la contraseña"><input type="password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} autoComplete="new-password" /></Field>
        <button className="btn g">Actualizar contraseña</button>
      </form>
    </div>
  )
}
