// Edge Function: permite a un ADMINISTRADOR crear estudiantes o instructores sin que
// la clave service_role llegue nunca al navegador.
//
// Despliegue:  supabase functions deploy admin-create-user
// (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase automáticamente.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1) Identificar a quien llama con SU token (no con service_role)
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: u } = await caller.auth.getUser()
    if (!u?.user) return json({ error: 'No autenticado' }, 401)
    const { data: prof } = await caller.from('profiles').select('role, active').eq('id', u.user.id).maybeSingle()
    if (!prof || prof.role !== 'admin' || !prof.active) return json({ error: 'Solo un administrador puede hacer esto' }, 403)

    // 2) Validar datos
    const { email, password, full_name, phone, role } = await req.json()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Correo no válido' }, 400)
    if (!password || String(password).length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    if (!full_name || String(full_name).trim().length < 2) return json({ error: 'Escribe el nombre completo' }, 400)
    const newRole = role === 'instructor' ? 'instructor' : 'student' // nunca "admin" desde aquí

    // 3) Crear el usuario con privilegios de servidor
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name, phone: phone ?? null },
    })
    if (error) return json({ error: error.message }, 400)

    if (newRole !== 'student' || phone) {
      await admin.from('profiles').update({ role: newRole, phone: phone ?? null }).eq('id', data.user.id)
    }
    return json({ id: data.user.id })
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
