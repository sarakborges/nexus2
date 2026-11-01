import { useEffect, useLayoutEffect } from 'react'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'
import { AppRoutes } from '@/routes'

export function App() {
  const { language } = useTranslations()
  const initializeAuth = useAuthStore(state => state.initialize)
  const isAuthInitialized = useAuthStore(state => state.isInitialized)
  const userId = useAuthStore(state => state.session?.user.id)
  const loadSettings = useSettingsStore(state => state.loadSettings)
  const resetSettings = useSettingsStore(state => state.resetSettings)
  useThemePreference()
  useEffect(() => { void initializeAuth() }, [initializeAuth])
  useEffect(() => {
    if (!isAuthInitialized) return
    if (userId) void loadSettings()
    else resetSettings()
  }, [isAuthInitialized, userId, loadSettings, resetSettings])
  useLayoutEffect(() => { document.documentElement.lang = language }, [language])
  return <AppRoutes />
}
