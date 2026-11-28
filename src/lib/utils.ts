export const ytId = (input: string) => {
  const value = (input || '').trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] || ''
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : ''
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      const id = url.pathname === '/watch'
        ? url.searchParams.get('v') || ''
        : ['embed', 'shorts', 'live', 'v'].includes(parts[0] || '') ? parts[1] || '' : ''
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : ''
    }
  } catch {
    return ''
  }
  return ''
}
export const money = (n: number, cur = 'BOB') =>
  n > 0 ? `${cur === 'BOB' ? 'Bs' : cur} ${Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 })}` : 'Gratis'
export const moneyAlways = (n: number, cur = 'BOB') => `${cur === 'BOB' ? 'Bs' : cur} ${Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 })}`
export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
export const firstName = (n: string) => (n || '').trim().split(' ')[0] || 'estudiante'

export const LEVELS: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' }
export const PAY_STATUS: Record<string, string> = { pending: 'Pendiente', paid: 'Pagado', partial: 'Parcial', cancelled: 'Cancelado', refunded: 'Reembolsado' }
export const METHODS: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', qr: 'QR' }
export const ENR_STATUS: Record<string, string> = { pending: 'Pendiente', active: 'Activo', revoked: 'Revocado' }
export const COURSE_STATUS: Record<string, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }

export function kindFromName(name: string): 'pdf' | 'presentation' | 'image' | 'file' {
  const e = name.split('.').pop()?.toLowerCase() || ''
  if (e === 'pdf') return 'pdf'
  if (['ppt', 'pptx', 'key', 'odp'].includes(e)) return 'presentation'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(e)) return 'image'
  return 'file'
}
export const safeName = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
}
export function downloadText(name: string, text: string, mime = 'text/csv;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: mime }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
export function monthsBack(n: number) {
  const out: { key: string; label: string }[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`, label: x.toLocaleDateString('es-BO', { month: 'short' }) })
  }
  return out
}
export const monthKey = (iso: string) => iso.slice(0, 7)
