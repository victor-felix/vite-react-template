import { createContext, useContext } from 'react'
import type { GitlabConfig } from '../types/gitlab'

const STORAGE_KEY = 'gitlab-burndown-config'

export function loadConfig(): GitlabConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GitlabConfig>
    if (!parsed.baseUrl || !parsed.token || !parsed.projectPath || !parsed.doneLabel) {
      return null
    }
    return parsed as GitlabConfig
  } catch {
    return null
  }
}

export function saveConfig(config: GitlabConfig): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearConfig(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export interface ConfigContextValue {
  config: GitlabConfig | null
  setConfig: (config: GitlabConfig) => void
  resetConfig: () => void
}

export const ConfigContext = createContext<ConfigContextValue | null>(null)

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig deve ser usado dentro de ConfigProvider')
  return ctx
}
