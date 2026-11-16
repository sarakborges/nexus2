import { useEffect, useLayoutEffect } from 'react'

import { useTranslations } from '@/Hooks/Language'
import { useAuthSession } from '@/Hooks/Auth'
import { useThemePreference } from '@/Hooks/Theme'
import type { UseAppInitializationResult } from './useAppInitialization.types'

export function useAppInitialization(): UseAppInitializationResult {
  const { language } = useTranslations()
  const authQuery = useAuthSession()

  useThemePreference()

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return {
    hasAuthenticatedSession: authQuery.isFetched && Boolean(authQuery.data?.user.id),
    shouldInitializeAuth: authQuery.isFetched
  }
}
