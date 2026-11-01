export const SUPPORTED_LANGUAGES = ['en'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_NAME_KEYS = {
  en: 'LANGUAGE_EN'
} as const satisfies Record<Language, string>
