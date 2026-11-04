import type { Language } from '@/Constants/languages'
import { enUSTranslations } from '@/Locales/en-US'
import { ptBRTranslations } from '@/Locales/pt-BR'
import type {
  TranslationKey,
  TranslationReplacements
} from '@/Types/Translation.type'

const translations: Record<Language, Record<TranslationKey, string>> = {
  'pt-BR': ptBRTranslations,
  'en-US': enUSTranslations
}

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
