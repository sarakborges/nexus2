import { create } from 'zustand'
import type { UserPreferences } from '@nexus/common'
import { api } from '@/Services/Http/api'
import type { SettingsType } from '@/Types/Settings.type'

type SettingsStore = {
  settings: SettingsType
  isRemote: boolean
  loadSettings: () => Promise<void>
  resetSettings: () => void
  updateSettings: (settings: Partial<SettingsType>) => void
}
const defaultSettings: SettingsType = { language: 'system', theme: 'system' }

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isRemote: false,
  loadSettings: async () => {
    try {
      const { data } = await api.get<UserPreferences>('/auth/preferences')
      set({ settings: data, isRemote: true })
    } catch {
      set({ settings: defaultSettings, isRemote: false })
    }
  },
  resetSettings: () => set({ settings: defaultSettings, isRemote: false }),
  updateSettings: (patch) => {
    const previous = get().settings
    const settings = { ...previous, ...patch }
    set({ settings })
    if (get().isRemote) {
      void api.post('/auth/preferences', patch).catch(() => set({ settings: previous }))
    }
  }
}))
