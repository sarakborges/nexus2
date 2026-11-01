import { translate } from '@/Helpers/Language'
import { useSystemPreferences } from '@/Hooks/System/useSystemPreferences.hook'
import { useSettingsStore } from '@/Stores/Settings.store'
import type { LanguagePreference } from '@/Constants/languages'
import type {
  TranslationKey,
  TranslationReplacements
} from '@/Types/Translation.type'

export function useTranslations() {
  const languagePreference = useSettingsStore(
    (state) => state.settings.language
  )
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const { language: systemLanguage } = useSystemPreferences()

  const language =
    languagePreference === 'system' ? systemLanguage : languagePreference

  const setLanguage = (language: LanguagePreference) => {
    updateSettings({ language })
  }

  const t = (
    key: TranslationKey,
    replacements?: TranslationReplacements
  ): string => translate(language, key, replacements)

  return { language, languagePreference, setLanguage, t }
}
