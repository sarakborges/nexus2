import { useEffect, useLayoutEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { FloatingNavigationBar, SettingsModal } from '@/Components'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { ROUTES } from '@/Constants/routes'
import { getCurrentAuthSession } from '@/Services/Auth'
import { getUserPreferences } from '@/Services/Settings'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'
import { AppRoutes } from '@/routes'
import { ToastViewport } from '@/Components/Organisms/Toast/ToastViewport.component'
import '@/Components/Molecules/ProfileTypeNotice/ProfileTypeNotice.style.scss'

export function App() {
  const { language } = useTranslations()
  const location = useLocation()
  const publicEntryRoutes = [ROUTES.landing, ROUTES.signIn, ROUTES.signUp]
  const shouldInitializeAuth = !publicEntryRoutes.includes(location.pathname)
  const setSession = useAuthStore(state => state.setSession)
  const isAuthInitialized = useAuthStore(state => state.isInitialized)
  const userId = useAuthStore(state => state.session?.user.id ?? null)
  const resetSettings = useSettingsStore(state => state.resetSettings)
  const setSettings = useSettingsStore(state => state.setSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const authQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getCurrentAuthSession,
    retry: false,
    enabled: shouldInitializeAuth
  })
  const preferencesQuery = useQuery({
    queryKey: queryKeys.auth.preferences(userId ?? ''),
    queryFn: getUserPreferences,
    enabled: shouldInitializeAuth && Boolean(userId)
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

  const hasAuthenticatedSession = isAuthInitialized && Boolean(userId)

  return (
    <>
      {hasAuthenticatedSession && shouldInitializeAuth && <FloatingNavigationBar onOpenSettings={() => setIsSettingsOpen(true)} />}
      <AppRoutes />
      <ToastViewport />
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}
