import { englishTranslations } from '@/Locales/en'
import type { Language } from '@/Constants/languages'
import type {
  TranslationKey,
  TranslationReplacements
} from '@/Types/Translation.type'

const translations = {
  en: englishTranslations
} satisfies Record<Language, typeof englishTranslations>

export const translate = (
  language: Language,
  key: TranslationKey,
  replacements?: TranslationReplacements
): string => {
  const message = translations[language][key]

  if (!replacements) {
    return message
  }

  return Object.entries(replacements).reduce(
    (currentMessage, [placeholder, value]) =>
      currentMessage.replaceAll(`{{${placeholder}}}`, String(value)),
    message
  )
}
