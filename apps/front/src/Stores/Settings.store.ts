import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  isLanguagePreference,
  SUPPORTED_LANGUAGES
} from '@/Constants/languages'
import { isThemePreference } from '@/Constants/themes'
import type { SettingsType } from '@/Types/Settings.type'

type SettingsStore = {
  settings: SettingsType
  updateSettings: (settings: Partial<SettingsType>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: {
        language: 'system',
        theme: 'system'
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
      name: 'nexus_preferences_v2',
      version: 2,
      partialize: (state) => ({ settings: state.settings }),
      merge: (persistedState, currentState) => {
        const persistedSettings = (
          persistedState as { settings?: Partial<SettingsType> } | undefined
        )?.settings

        return {
          ...currentState,
          settings: {
            language: isLanguagePreference(persistedSettings?.language)
              ? persistedSettings.language
              : 'system',
            theme: isThemePreference(persistedSettings?.theme)
              ? persistedSettings.theme
              : 'system'
          }
        }
      }
    }
  )
)
