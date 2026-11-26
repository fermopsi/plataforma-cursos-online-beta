import { useSettings } from '@/lib/settings'
import { fmtDate } from '@/lib/utils'
import type { Settings } from '@/lib/types'
import { Modal, useToast } from './ui'

export interface CertData { student: string; course: string; date: string; code: string }

function rgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#308CA2'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

/** Genera el PDF del certificado en el navegador (A4 horizontal). */
export async function downloadCertificatePdf(c: CertData, s: Settings) {
  const { jsPDF } = await import('jspdf')
  const d = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight()
  const [r, g, b] = rgb(s.brand_color)
  d.setFillColor(255, 255, 255); d.rect(0, 0, W, H, 'F')
  d.setDrawColor(r, g, b); d.setLineWidth(5); d.rect(28, 28, W - 56, H - 56)
  d.setLineWidth(1.2); d.rect(40, 40, W - 80, H - 80)
  d.setFillColor(0, 29, 68); d.rect(40, 40, W - 80, 10, 'F')

  d.setTextColor(0, 29, 68)
  d.setFont('helvetica', 'bold'); d.setFontSize(20); d.text(s.academy_name.toUpperCase(), W / 2, 100, { align: 'center' })
  d.setFont('helvetica', 'normal'); d.setFontSize(12); d.setTextColor(100, 116, 139)
  d.text('CERTIFICADO DE FINALIZACIÓN', W / 2, 122, { align: 'center' })
  d.setTextColor(0, 29, 68); d.setFontSize(14); d.text('Se certifica que', W / 2, 180, { align: 'center' })
  d.setFont('times', 'bold'); d.setFontSize(40); d.setTextColor(r, g, b)
  d.text(c.student, W / 2, 235, { align: 'center', maxWidth: W - 140 })
  d.setDrawColor(r, g, b); d.setLineWidth(1); d.line(W / 2 - 160, 248, W / 2 + 160, 248)
  d.setFont('helvetica', 'normal'); d.setFontSize(14); d.setTextColor(30, 41, 59)
  d.text(s.cert_text, W / 2, 282, { align: 'center', maxWidth: W - 160 })
  d.setFont('helvetica', 'bold'); d.setFontSize(24); d.setTextColor(0, 29, 68)
  d.text(c.course, W / 2, 322, { align: 'center', maxWidth: W - 160 })
  d.setFont('helvetica', 'normal'); d.setFontSize(12); d.setTextColor(100, 116, 139)
  d.text(`Fecha de finalización: ${fmtDate(c.date)}`, W / 2, 372, { align: 'center' })

  d.setDrawColor(100, 116, 139); d.setLineWidth(0.8); d.line(W / 2 - 110, H - 112, W / 2 + 110, H - 112)
  d.setTextColor(0, 29, 68); d.setFont('helvetica', 'bold'); d.setFontSize(12); d.text(s.cert_signer_name, W / 2, H - 96, { align: 'center' })
  d.setFont('helvetica', 'normal'); d.setTextColor(100, 116, 139); d.setFontSize(10); d.text(s.cert_signer_title, W / 2, H - 82, { align: 'center' })
  d.setFontSize(9); d.text(`Código de verificación: ${c.code}`, 60, H - 56)
  d.text(`Verifica en ${location.origin}/verificar`, W - 60, H - 56, { align: 'right' })
  d.save(`Certificado-${c.code}.pdf`)
}

export function CertificateView({ cert }: { cert: CertData }) {
  const { settings: s } = useSettings()
  return (
    <div className="cert">
      <div style={{ fontWeight: 700, letterSpacing: '.08em' }}>{s.academy_name.toUpperCase()}</div>
      <p className="mu">Certificado de finalización · Se certifica que</p>
      <h2 style={{ color: s.brand_color }}>{cert.student}</h2>
      <p>{s.cert_text}</p>
      <h3 style={{ color: '#001D44', fontSize: 22 }}>{cert.course}</h3>
      <p className="mu">Fecha de finalización: {fmtDate(cert.date)}</p>
      <hr className="sep" style={{ maxWidth: 220, margin: '18px auto 8px' }} />
      <b>{s.cert_signer_name}</b><div className="mu">{s.cert_signer_title}</div>
      <p className="mu" style={{ marginTop: 14 }}>Código: {cert.code}</p>
    </div>
  )
}

export function CertificateModal({ cert, onClose }: { cert: CertData; onClose: () => void }) {
  const { settings } = useSettings()
  const toast = useToast()
  return (
    <Modal title="Tu certificado" onClose={onClose} wide>
      <CertificateView cert={cert} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { downloadCertificatePdf(cert, settings); toast('Descargando PDF…') }}>Descargar PDF</button>
        <button className="btn g" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
