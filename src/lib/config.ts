import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Origen de la configuración (en este orden):
 *  1) Variables de entorno de Vite (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 *  2) public/config.js  → window.__LMS_CONFIG__
 *  3) localStorage del navegador (lo escribe el asistente de instalación)
 * Solo se admiten claves PÚBLICAS (anon / publishable). La service_role nunca se usa aquí.
 */
export interface SbConfig { url: string; key: string }
const LS = 'lms.supabase'

declare global { interface Window { __LMS_CONFIG__?: Partial<SbConfig> } }

export function readConfig(): SbConfig | null {
  const eu = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const ek = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (eu && ek) return { url: eu, key: ek }
  const w = window.__LMS_CONFIG__
  if (w?.url && w?.key) return { url: w.url, key: w.key }
  try {
    const raw = localStorage.getItem(LS)
    if (raw) { const c = JSON.parse(raw); if (c.url && c.key) return c }
  } catch { /* ignorar */ }
  return null
}
export const saveConfig = (c: SbConfig) => localStorage.setItem(LS, JSON.stringify(c))
export const clearConfig = () => localStorage.removeItem(LS)

export const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, '')
export const makeClient = (c: SbConfig): SupabaseClient =>
  createClient(normalizeUrl(c.url), c.key.trim(), { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })

let _sb: SupabaseClient | null = null
export function getSb(): SupabaseClient | null {
  if (!_sb) { const c = readConfig(); if (c) _sb = makeClient(c) }
  return _sb
}
export function sb(): SupabaseClient {
  const c = getSb()
  if (!c) throw new Error('La plataforma todavía no está configurada')
  return c
}
/** Convierte la respuesta de Supabase en datos o lanza un error legible. */
export function must<T = any>(r: { data: any; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}
