import { useQuery } from '@tanstack/react-query'

import { useEffect, useLayoutEffect } from 'react'

import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { getCurrentAuthSession } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseAppInitializationResult } from './useAppInitialization.types'

export function useAppInitialization(): UseAppInitializationResult {
  const { language } = useTranslations()
  // The session endpoint validates the HttpOnly auth cookies on every route.
  const shouldInitializeAuth = true
  const setSession = useAuthStore((state) => state.setSession)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const session = useAuthStore((state) => state.session)

  const authQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getCurrentAuthSession,
    retry: false,
    enabled: shouldInitializeAuth
  })

  useThemePreference()

  useEffect(() => {
    if (authQuery.isSuccess) {
      setSession(authQuery.data ?? null)
    } else if (authQuery.isError && !session) {
      // A transient BFF/network failure must not erase a session that was
      // already hydrated by sign-in or by a previous successful /auth/me.
      setSession(null, true)
    }
  }, [authQuery.isSuccess, authQuery.isError, authQuery.data, setSession, session])

  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return {
    hasAuthenticatedSession: isAuthInitialized && Boolean(session?.user.id),
    shouldInitializeAuth
  }
}
