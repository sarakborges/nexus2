import type { TranslationKey } from '@/Types/Translation.type'

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en-US'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export type LanguagePreference = Language | 'system'

export const LANGUAGE_NAME_KEYS = {
  'pt-BR': 'LANGUAGE_PT_BR',
  'en-US': 'LANGUAGE_EN_US'
} as const satisfies Record<Language, TranslationKey>

export const LANGUAGE_FLAG_PATHS = {
  'pt-BR': '/languages/pt-BR.svg',
  'en-US': '/languages/en-US.svg'
} as const satisfies Record<Language, string>

export const isLanguage = (value: unknown): value is Language =>
  SUPPORTED_LANGUAGES.some((language) => language === value)

export const isLanguagePreference = (
  value: unknown
): value is LanguagePreference => value === 'system' || isLanguage(value)
