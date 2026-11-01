import type { enUSTranslations } from '@/Locales/en-US'

export type TranslationKey = keyof typeof enUSTranslations

export type TranslationReplacements = Readonly<Record<string, string | number>>
