import { SUPPORTED_LANGUAGE_PREFERENCES } from '@/Constants/languages'
import { useTranslations } from '@/Hooks/Language/useTranslations.hook'
import { LanguageOption } from '@/Components/Molecules/LanguageOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'

export function LanguageSelector() {
  const { t } = useTranslations()

  return (
    <PreferenceSelector title={t('LANGUAGES_TITLE')}>
      {SUPPORTED_LANGUAGE_PREFERENCES.map(language => (
        <LanguageOption key={language} language={language} />
      ))}
    </PreferenceSelector>
  )
}
