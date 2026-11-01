import { useEffect, useLayoutEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SettingsModal } from '@/Components'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { getCurrentAuthSession } from '@/Services/Auth'
import { getUserPreferences } from '@/Services/Settings'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'
import { AppRoutes } from '@/routes'
import './App.style.scss'

export function App() {
  const { language, t } = useTranslations()
  const setSession = useAuthStore(state => state.setSession)
  const isAuthInitialized = useAuthStore(state => state.isInitialized)
  const userId = useAuthStore(state => state.session?.user.id ?? null)
  const resetSettings = useSettingsStore(state => state.resetSettings)
  const setSettings = useSettingsStore(state => state.setSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const authQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getCurrentAuthSession,
    retry: false
  })
  const preferencesQuery = useQuery({
    queryKey: queryKeys.auth.preferences(userId ?? ''),
    queryFn: getUserPreferences,
    enabled: Boolean(userId)
  })

  useThemePreference()

  useEffect(() => {
    if (authQuery.isSuccess) setSession(authQuery.data ?? null)
    else if (authQuery.isError) setSession(null, true)
  }, [authQuery.isSuccess, authQuery.isError, authQuery.data, setSession])

  useEffect(() => {
    if (preferencesQuery.data) setSettings(preferencesQuery.data)
  }, [preferencesQuery.data, setSettings])

  useEffect(() => {
    if (isAuthInitialized && !userId) resetSettings()
  }, [isAuthInitialized, userId, resetSettings])

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
