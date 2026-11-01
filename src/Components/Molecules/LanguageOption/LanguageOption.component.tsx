import { FaCheck } from 'react-icons/fa'

import { LANGUAGE_NAME_KEYS, type Language } from '@/Constants/languages'
import { useTranslations } from '@/Hooks/Language/useTranslations.hook'
import { useSettingsStore } from '@/Stores/Settings.store'

import { ShadowButton, Text } from '@/DesignSystem'
import { LanguageFlag } from '@/Components/Atoms/LanguageFlag'

import './LanguageOption.style.scss'

type LanguageOptionProps = {
  language: Language
}

export function LanguageOption({ language }: LanguageOptionProps) {
  const selectedLanguage = useSettingsStore(
    (state) => state.settings.language
  )
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const { t } = useTranslations()

  const isSelected = selectedLanguage === language
  const languageName = t(LANGUAGE_NAME_KEYS[language])

  const handleSelect = () => {
    updateSettings({ language })
  }

  return (
    <ShadowButton
      className="language-option"
      type="button"
      onClick={handleSelect}
      aria-pressed={isSelected}
    >
      <LanguageFlag language={language} />

      <Text className="language-option__label">{languageName}</Text>

      {isSelected && (
        <FaCheck
          className="language-option__selected-icon"
          aria-hidden="true"
        />
      )}
    </ShadowButton>
  )
}
