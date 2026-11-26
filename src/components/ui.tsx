import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSettings } from '@/lib/settings'
import type { Course } from '@/lib/types'

/* ---------- Toasts ---------- */
const ToastCtx = createContext<(m: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [m, setM] = useState<{ t: string; k: string } | null>(null)
  const timer = useRef<number>()
  const show = useCallback((t: string, k: 'ok' | 'err' = 'ok') => {
    setM({ t, k }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setM(null), 3000)
  }, [])
  return <ToastCtx.Provider value={show}>{children}{m && <div id="toast" className={m.k} role="status">{m.t}</div>}</ToastCtx.Provider>
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'md' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row sp" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>{title}</h3><button className="btn s g" onClick={onClose} aria-label="Cerrar">✕</button></div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Estados ---------- */
export const Loading = ({ text = 'Cargando…' }: { text?: string }) => <div className="wrap"><div className="card mu">{text}</div></div>
export const ErrorBox = ({ msg }: { msg: string }) => <div className="wrap"><div className="card err">No se pudo cargar: {msg}</div></div>
export const Empty = ({ children }: { children: ReactNode }) => <div className="card mu">{children}</div>
export function Badge({ s, label }: { s: string; label: string }) { return <span className={'st ' + s}>{label}</span> }
export const Ring = ({ p }: { p: number }) => <div className="ring" style={{ ['--v' as string]: p }}><span>{p}%</span></div>

export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="lb">{label}{children}</label> }

/** Campo que guarda al salir de él (blur). Ideal para edición en línea. */
export function Editable({ value, onCommit, textarea, rows = 3, type = 'text', placeholder, min, style }: {
  value: string | number; onCommit: (v: string) => void; textarea?: boolean; rows?: number; type?: string; placeholder?: string; min?: number; style?: React.CSSProperties
}) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  const commit = () => { if (v !== String(value ?? '')) onCommit(v) }
  return textarea
    ? <textarea rows={rows} value={v} placeholder={placeholder} style={style} onChange={(e) => setV(e.target.value)} onBlur={commit} />
    : <input type={type} min={min} value={v} placeholder={placeholder} style={style} onChange={(e) => setV(e.target.value)} onBlur={commit} />
}

/* ---------- Iconos y portadas ---------- */
export const IC: Record<string, string> = {
  marketing: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  gestion: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  diseno: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  finanzas: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  tecnologia: 'M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12',
  ok: 'M5 12l5 5 9-10',
}
export const ICON_KEYS = ['marketing', 'gestion', 'diseno', 'finanzas', 'tecnologia']
export const Icon = ({ name, size = 24 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={IC[name] || IC.gestion} /></svg>
)
export function coverArt(icon = 'gestion', seed = 0) {
  const x = [330, 70, 300, 100][seed % 4]
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#001D44'/><stop offset='1' stop-color='#44679B'/></linearGradient><pattern id='p' width='24' height='24' patternUnits='userSpaceOnUse'><path d='M24 0H0V24' fill='none' stroke='#fff' stroke-opacity='.07'/></pattern></defs><rect width='400' height='225' fill='url(#g)'/><rect width='400' height='225' fill='url(#p)'/><circle cx='${x}' cy='50' r='70' fill='#308CA2' fill-opacity='.45'/><g transform='translate(152 64) scale(4)' fill='none' stroke='#fff' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'><path d='${IC[icon] || IC.gestion}'/></g></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
export const courseImg = (c: Pick<Course, 'cover_url' | 'title'>, icon?: string) =>
  c.cover_url || coverArt(icon, c.title.length)

export function Logo({ size = 30 }: { size?: number }) {
  const { settings } = useSettings()
  if (settings.logo_url) return <img src={settings.logo_url} alt="" style={{ height: size, width: 'auto', borderRadius: 6 }} />
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--t)" /><path d="M9 23V9l14 14V9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  )
}
