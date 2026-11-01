import { useLayoutEffect } from 'react'

import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { AppRoutes } from '@/routes'

export function App() {
  const { language } = useTranslations()

  useThemePreference()

  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return <AppRoutes />
}
