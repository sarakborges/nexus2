import type { LanguageOptionProps } from './LanguageOption.types'
import { LanguageFlag } from '@/Components/Atoms/LanguageFlag'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { LANGUAGE_PREFERENCE_NAME_KEYS } from '@/Constants/languages'
import { useTranslations } from '@/Hooks/Language/useTranslations.hook'


export function LanguageOption({ language }: LanguageOptionProps) {
  const {
    languagePreference: selectedPreference,
    setLanguage,
    t,
    isUpdating
  } = useTranslations()

  return (
    <PreferenceOption
      label={t(LANGUAGE_PREFERENCE_NAME_KEYS[language])}
      isSelected={selectedPreference === language}
      onSelect={() => setLanguage(language)}
      disabled={isUpdating}
      leadingVisual={
        language !== 'system' ? <LanguageFlag language={language} /> : undefined
      }
    />
  )
}
