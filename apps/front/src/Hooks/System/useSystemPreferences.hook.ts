import { useSyncExternalStore } from 'react'

import { SUPPORTED_LANGUAGES } from '@/Constants/languages'
import type { Language } from '@/Constants/languages'
import type { Theme } from '@/Constants/themes'
import type { UseSystemPreferencesResult } from './useSystemPreferences.types'

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'
const DEFAULT_LANGUAGE: Language = SUPPORTED_LANGUAGES[0]

function getSystemLanguage(): Language {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const browserLanguages =
    navigator.languages.length > 0 ? navigator.languages : [navigator.language]

  for (const browserLanguage of browserLanguages) {
    const languageCode = browserLanguage.toLowerCase().split(/[-_]/)[0]

    if (languageCode === 'pt') {
      return 'pt-BR'
    }

    if (languageCode === 'en') {
      return 'en-US'
    }
  }

  return DEFAULT_LANGUAGE
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light'
}

function getSnapshot(): string {
  return `${getSystemLanguage()}|${getSystemTheme()}`
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const colorScheme = window.matchMedia?.(COLOR_SCHEME_QUERY)

  window.addEventListener('languagechange', onStoreChange)
  colorScheme?.addEventListener('change', onStoreChange)

  return () => {
    window.removeEventListener('languagechange', onStoreChange)
    colorScheme?.removeEventListener('change', onStoreChange)
  }
}

const getServerSnapshot = (): string => 'pt-BR|light'

export function useSystemPreferences(): UseSystemPreferencesResult {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  const [languageSnapshot, themeSnapshot] = snapshot.split('|')
  const language =
    SUPPORTED_LANGUAGES.find(
      (supportedLanguage) => supportedLanguage === languageSnapshot
    ) ?? DEFAULT_LANGUAGE
  const theme: Theme = themeSnapshot === 'dark' ? 'dark' : 'light'

  return { language, theme }
}
