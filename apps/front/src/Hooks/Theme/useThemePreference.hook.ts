import { useLayoutEffect } from 'react'

import { useSystemPreferences } from '@/Hooks/System/useSystemPreferences.hook'
import { useSettingsStore } from '@/Stores/Settings.store'
import type { ThemePreference } from '@/Constants/themes'

export function useThemePreference() {
  const themePreference = useSettingsStore(
    (state) => state.settings.theme
  )
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const { theme: systemTheme } = useSystemPreferences()

  const theme = themePreference === 'system' ? systemTheme : themePreference

  useLayoutEffect(() => {
    const root = document.documentElement

    root.dataset.theme = theme
    root.style.colorScheme = theme
  }, [theme])

  const setTheme = (theme: ThemePreference) => {
    updateSettings({ theme })
  }

  return { theme, themePreference, setTheme }
}
