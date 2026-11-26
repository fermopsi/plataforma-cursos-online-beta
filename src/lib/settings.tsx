import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { getSb } from './config'
import { DEFAULT_SETTINGS, Settings } from './types'

interface SettingsCtx { settings: Settings; reload: () => Promise<void> }
const Ctx = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, reload: async () => {} })
export const useSettings = () => useContext(Ctx)

export function applyBrand(color: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) document.documentElement.style.setProperty('--t', color)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const reload = useCallback(async () => {
    const c = getSb()
    if (!c) return
    const { data } = await c.from('platform_settings').select('*').eq('id', 1).maybeSingle()
    if (data) { setSettings({ ...DEFAULT_SETTINGS, ...(data as Settings) }); applyBrand((data as Settings).brand_color) }
  }, [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { document.title = `${settings.academy_name} · Academia online` }, [settings.academy_name])
  return <Ctx.Provider value={{ settings, reload }}>{children}</Ctx.Provider>
}
