import { useLayoutEffect } from 'react'

import type { ThemePreference } from '@/Constants/themes'
import type { UseThemePreferenceResult } from './useThemePreference.types'
import { useUpdateSettings } from '@/Hooks/Settings/useUpdateSettings.hook'
import { useSystemPreferences } from '@/Hooks/System/useSystemPreferences.hook'
import { useSettingsStore } from '@/Stores/Settings.store'

export function useThemePreference(): UseThemePreferenceResult {
  const themePreference = useSettingsStore((state) => state.settings.theme)
  const { updateSettings, isUpdating } = useUpdateSettings()
  const { theme: systemTheme } = useSystemPreferences()
  const theme =
    themePreference === 'light' || themePreference === 'dark'
      ? themePreference
      : systemTheme

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
  }, [theme])

  const setTheme = (nextTheme: ThemePreference) =>
    updateSettings({ theme: nextTheme })
  return { theme, themePreference, setTheme, isUpdating }
}
