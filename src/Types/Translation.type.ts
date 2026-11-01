import type { englishTranslations } from '@/Locales/en'

export type TranslationKey = keyof typeof englishTranslations

export type TranslationReplacements = Readonly<Record<string, string | number>>
