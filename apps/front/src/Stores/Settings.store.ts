import { create } from 'zustand'
import type { UserPreferences } from '@nexus/common'
import type { SettingsType } from '@/Types/Settings.type'

type SettingsStore = {
  settings: SettingsType
  updateError: boolean
  setSettings: (settings: UserPreferences) => void
  setUpdateError: (hasError: boolean) => void
  resetSettings: () => void
  updateSettings: (settings: Partial<SettingsType>) => void
}
const defaultSettings: SettingsType = { language: 'system', theme: 'system' }

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  updateError: false,
  setSettings: settings => set({ settings }),
  setUpdateError: updateError => set({ updateError }),
  resetSettings: () => set({ settings: defaultSettings, updateError: false }),
  updateSettings: patch => set(state => ({ settings: { ...state.settings, ...patch } }))
}))
