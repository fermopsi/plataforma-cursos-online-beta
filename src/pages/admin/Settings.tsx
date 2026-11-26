import { FormEvent, useEffect, useState } from 'react'
import { Field, Logo, useToast } from '@/components/ui'
import { sb } from '@/lib/config'
import { applyBrand, useSettings } from '@/lib/settings'
import type { Settings } from '@/lib/types'
import { safeName } from '@/lib/utils'
import { CertificateView } from '@/components/Certificate'

export default function AdminSettings() {
  const { settings, reload } = useSettings(); const toast = useToast()
  const [f, setF] = useState<Settings>(settings); const [busy, setBusy] = useState(false)
  useEffect(() => setF(settings), [settings])
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setF({ ...f, [k]: v }); if (k === 'brand_color') applyBrand(String(v)) }
  const T = (k: keyof Settings, label: string, ta = false) => <Field label={label}>{ta
    ? <textarea rows={3} value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} />
    : <input value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} />}</Field>

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    const { id: _id, ...rest } = f as Settings & { id?: number }; void _id
    const { error } = await sb().from('platform_settings').upsert({ id: 1, ...rest, whatsapp: f.whatsapp.replace(/\D/g, ''), updated_at: new Date().toISOString() })
    setBusy(false); if (error) return toast(error.message, 'err'); await reload(); toast('Configuración guardada')
  }
  const logo = async (file?: File) => {
    if (!file) return; if (file.size > 2 * 1024 * 1024) return toast('El logo debe pesar menos de 2 MB', 'err')
    const path = `logo-${Date.now()}-${safeName(file.name)}`
    const up = await sb().storage.from('branding').upload(path, file); if (up.error) return toast(up.error.message, 'err')
    set('logo_url', sb().storage.from('branding').getPublicUrl(path).data.publicUrl); toast('Logo cargado · recuerda guardar')
  }
  return (
    <form onSubmit={save} className="f">
      <div className="row sp"><h1>Configuración</h1><button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
      <div className="card f"><h3>Identidad</h3>
        {T('academy_name', 'Nombre de la academia')}{T('tagline', 'Lema')}
        <div className="row"><Logo size={40} /><Field label="Logo (PNG/SVG, máx. 2 MB)"><input type="file" accept="image/*" onChange={(e) => logo(e.target.files?.[0])} /></Field>
          {f.logo_url && <button type="button" className="btn s g" onClick={() => set('logo_url', null)}>Quitar logo</button>}</div>
        <Field label="Color principal"><input type="color" value={f.brand_color} onChange={(e) => set('brand_color', e.target.value)} /></Field></div>
      <div className="card f"><h3>Página principal</h3>{T('hero_title', 'Título principal')}{T('hero_subtitle', 'Subtítulo', true)}{T('enroll_cta_label', 'Texto del botón de inscripción')}{T('description', 'Presentación de la academia (Nosotros)', true)}</div>
      <div className="card f"><h3>Contacto</h3>
        <Field label="WhatsApp (con código de país, solo números)"><input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
        {T('contact_email', 'Correo de contacto')}{T('instagram', 'Instagram (URL)')}{T('facebook', 'Facebook (URL)')}</div>
      <div className="card f"><h3>Certificados</h3>{T('cert_signer_name', 'Nombre de quien firma')}{T('cert_signer_title', 'Cargo / institución')}{T('cert_text', 'Texto del certificado')}
        <CertificateView cert={{ student: 'Nombre del estudiante', course: 'Nombre del curso', date: new Date().toISOString(), code: 'ANL-2026-EJEMPLO' }} /></div>
    </form>
  )
}
