import { useEffect, useLayoutEffect, useState } from 'react'
import { SettingsModal } from '@/Components'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'
import { AppRoutes } from '@/routes'
import './App.style.scss'

export function App() {
  const { language, t } = useTranslations()
  const initializeAuth = useAuthStore(state => state.initialize)
  const isAuthInitialized = useAuthStore(state => state.isInitialized)
  const userId = useAuthStore(state => state.session?.user.id)
  const loadSettings = useSettingsStore(state => state.loadSettings)
  const resetSettings = useSettingsStore(state => state.resetSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  useThemePreference()
  useEffect(() => { void initializeAuth() }, [initializeAuth])
  useEffect(() => {
    if (!isAuthInitialized) return
    if (userId) void loadSettings()
    else resetSettings()
  }, [isAuthInitialized, userId, loadSettings, resetSettings])
  useLayoutEffect(() => { document.documentElement.lang = language }, [language])
  return (
    <>
      <div className="app-settings-control">
        <Button variation="secondary" onClick={() => setIsSettingsOpen(true)}>{t('SETTINGS_TITLE')}</Button>
      </div>
      <AppRoutes />
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}
