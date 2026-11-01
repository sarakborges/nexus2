import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { isLanguage, SUPPORTED_LANGUAGES } from '@/Constants/languages'
import type { SettingsType } from '@/Types/Settings.type'

type SettingsStore = {
  settings: SettingsType
  updateSettings: (settings: Partial<SettingsType>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: {
        language: SUPPORTED_LANGUAGES[0]
      },

      updateSettings: (settings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...settings
          }
        }))
      }
    }),
    {
      name: 'nexus_settings_v1',
      partialize: (state) => ({ settings: state.settings }),
      merge: (persistedState, currentState) => {
        const persistedSettings = (
          persistedState as { settings?: Partial<SettingsType> } | undefined
        )?.settings
        const persistedLanguage = persistedSettings?.language

        return {
          ...currentState,
          settings: {
            ...currentState.settings,
            language: isLanguage(persistedLanguage)
              ? persistedLanguage
              : currentState.settings.language
          }
        }
      }
    }
  )
)
