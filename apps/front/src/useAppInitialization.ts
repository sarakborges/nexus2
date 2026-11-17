import { useLayoutEffect } from 'react'

import { useAuthSession } from '@/Hooks/Auth'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import type { UseAppInitializationResult } from './useAppInitialization.types'

export function useAppInitialization(): UseAppInitializationResult {
  const { language } = useTranslations()
  const authQuery = useAuthSession()

  useThemePreference()

  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return {
    hasAuthenticatedSession: authQuery.isFetched && Boolean(authQuery.data?.user.id),
    shouldInitializeAuth: authQuery.isFetched
  }
}
