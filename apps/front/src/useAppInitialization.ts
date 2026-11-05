import { useQuery } from '@tanstack/react-query'

import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { getCurrentAuthSession } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getUserPreferences } from '@/Services/Settings'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'

const PUBLIC_ENTRY_ROUTES = [
  ROUTES.landing,
  ROUTES.signIn,
  ROUTES.signUp
] as const

export function useAppInitialization() {
  const { language } = useTranslations()
  const location = useLocation()
  const shouldInitializeAuth = !PUBLIC_ENTRY_ROUTES.some(
    (route) => route === location.pathname
  )
  const setSession = useAuthStore((state) => state.setSession)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const userId = useAuthStore((state) => state.session?.user.id ?? null)
  const resetSettings = useSettingsStore((state) => state.resetSettings)
  const setSettings = useSettingsStore((state) => state.setSettings)

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

  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return {
    hasAuthenticatedSession: isAuthInitialized && Boolean(userId),
    shouldInitializeAuth
  }
}
