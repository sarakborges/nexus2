import { translate } from '@/Helpers/Language'
import { useSettingsStore } from '@/Stores/Settings.store'
import type {
  TranslationKey,
  TranslationReplacements
} from '@/Types/Translation.type'

export function useTranslations() {
  const language = useSettingsStore((state) => state.settings.language)

  const t = (
    key: TranslationKey,
    replacements?: TranslationReplacements
  ): string => translate(language, key, replacements)

  return { language, t }
}
