import { FaCheck } from 'react-icons/fa'

import {
  LANGUAGE_PREFERENCE_NAME_KEYS,
  type LanguagePreference
} from '@/Constants/languages'
import { useTranslations } from '@/Hooks/Language/useTranslations.hook'

import { Button, Text } from '@/DesignSystem'
import { LanguageFlag } from '@/Components/Atoms/LanguageFlag'

import './LanguageOption.style.scss'

type LanguageOptionProps = {
  language: LanguagePreference
}

export function LanguageOption({ language }: LanguageOptionProps) {
  const {
    languagePreference: selectedPreference,
    setLanguage,
    t
  } = useTranslations()

  const isSelected = selectedPreference === language
  const languageName = t(LANGUAGE_PREFERENCE_NAME_KEYS[language])

  const handleSelect = () => {
    setLanguage(language)
  }

  return (
    <Button
      className="language-option"
      type="button"
      variation="transparent"
      onClick={handleSelect}
      aria-pressed={isSelected}
    >
      {language !== 'system' && <LanguageFlag language={language} />}

      <Text className="language-option__label">{languageName}</Text>

      {isSelected && (
        <FaCheck
          className="language-option__selected-icon"
          aria-hidden="true"
        />
      )}
    </Button>
  )
}
