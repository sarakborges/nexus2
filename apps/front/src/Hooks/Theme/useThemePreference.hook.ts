import { useLayoutEffect } from 'react'
import { useSystemPreferences } from '@/Hooks/System/useSystemPreferences.hook'
import { useUpdateSettings } from '@/Hooks/Settings/useUpdateSettings.hook'
import { useSettingsStore } from '@/Stores/Settings.store'
import type { ThemePreference } from '@/Constants/themes'

export function useThemePreference() {
  const themePreference = useSettingsStore(state => state.settings.theme)
  const { updateSettings, mutation } = useUpdateSettings()
  const { theme: systemTheme } = useSystemPreferences()
  const theme = themePreference === 'system' ? systemTheme : themePreference

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
  }, [theme])

  const setTheme = (nextTheme: ThemePreference) => updateSettings({ theme: nextTheme })
  return { theme, themePreference, setTheme, isUpdating: mutation.isPending }
}
