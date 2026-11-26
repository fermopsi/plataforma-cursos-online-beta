import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSb, sb } from './config'
import type { Profile, Role } from './types'

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
export const useAuth = () => useContext(Ctx)

export const homeFor = (r?: Role | null) => (r === 'admin' ? '/admin' : r === 'instructor' ? '/instructor' : '/estudiante')

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSb()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(!!client)

  useEffect(() => {
    if (!client) return
    client.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false) })
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [client])

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); setLoading(false); return }
    const { data } = await sb().from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as Profile) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!client) return
    if (session?.user.id) loadProfile(session.user.id)
    else if (!loading) setProfile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, client])

  const value: AuthCtx = {
    session, profile, loading,
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
    },
    async signUp(email, password, fullName, phone) {
      const { data, error } = await sb().auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim(), phone: phone.trim() } } })
      if (error) throw new Error(error.message)
      return { needsConfirm: !data.session }
    },
    async signOut() { await sb().auth.signOut(); setProfile(null) },
    refresh: () => loadProfile(session?.user.id),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
