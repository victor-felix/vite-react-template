import { useMemo, useState, type ReactNode } from 'react'
import type { GitlabConfig } from '../types/gitlab'
import { ConfigContext, clearConfig, loadConfig, saveConfig } from '../lib/config'

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<GitlabConfig | null>(() => loadConfig())

  const value = useMemo(
    () => ({
      config,
      setConfig: (next: GitlabConfig) => {
        saveConfig(next)
        setConfigState(next)
      },
      resetConfig: () => {
        clearConfig()
        setConfigState(null)
      },
    }),
    [config],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}
