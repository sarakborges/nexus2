import type { Language, LanguagePreference } from '@/Constants/languages'
import type {
  TranslationKey,
  TranslationReplacements
} from '@/Types/Translation.type'

export type TranslationFunction = (
  key: TranslationKey,
  replacements?: TranslationReplacements
) => string

export type UseTranslationsResult = {
  language: Language
  languagePreference: LanguagePreference
  setLanguage: (language: LanguagePreference) => void
  t: TranslationFunction
  isUpdating: boolean
}
