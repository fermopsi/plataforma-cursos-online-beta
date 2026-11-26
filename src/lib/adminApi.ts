import { sb } from './config'

/** Crea un usuario mediante la Edge Function (usa service_role SOLO en el servidor). */
export async function adminCreateUser(p: { email: string; password: string; full_name: string; phone?: string; role: 'student' | 'instructor' }) {
  const { data, error } = await sb().functions.invoke('admin-create-user', { body: p })
  if (error) {
    const ctx = (error as unknown as { context?: Response }).context
    let body: { error?: string; message?: string } | null = null
    try { body = await ctx?.json() } catch { /* sin cuerpo */ }
    if (ctx?.status === 404) throw new Error('NO_FUNCTION')
    throw new Error(body?.error || body?.message || error.message)
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return (data as { id: string }).id
}
export const NO_FUNCTION_MSG = 'Para crear cuentas desde el panel hay que desplegar una vez la función "admin-create-user" (ver README, paso 5). Mientras tanto, la persona puede registrarse sola en /registro y tú la inscribes desde Inscripciones y pagos.'
