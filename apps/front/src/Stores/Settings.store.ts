import type { UserPreferences } from '@nexus/common'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { SettingsType } from '@/Types/Settings.type'

type SettingsStore = {
  settings: SettingsType
  updateError: boolean
  setUpdateError: (hasError: boolean) => void
  updateSettings: (settings: Partial<SettingsType>) => void
}
const defaultSettings: SettingsType = { language: 'system', theme: 'system' }

function isLanguagePreference(value: unknown): value is SettingsType['language'] {
  return value === 'system' || value === 'pt-BR' || value === 'en-US'
}

function isThemePreference(value: unknown): value is SettingsType['theme'] {
  return value === 'system' || value === 'light' || value === 'dark'
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateError: false,
      setUpdateError: (updateError) => set({ updateError }),
      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } }))
    }),
    {
      name: 'nexus-display-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | { settings?: Partial<UserPreferences> }
          | undefined
        const language = persisted?.settings?.language
        const theme = persisted?.settings?.theme

        return {
          ...currentState,
          settings: {
            language: isLanguagePreference(language)
              ? language
              : defaultSettings.language,
            theme: isThemePreference(theme)
              ? theme
              : defaultSettings.theme
          }
        }
      }
    }
  )
)
