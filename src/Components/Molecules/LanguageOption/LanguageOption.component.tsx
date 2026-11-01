import { FaCheck } from 'react-icons/fa'

import { getTexts } from '@/Helpers/Language'
import { updateSettings } from '@/Helpers/Systems/Settings'

import { useSettingsStore } from '@/Stores/Settings.store'

import { ShadowButton, Text } from '@/DesignSystem'
import { LanguageFlag } from '@/Components/Atoms/LanguageFlag'

import './LanguageOption.style.scss'

type LanguageOptionProps = {
  language: string
}

export function LanguageOption({ language }: LanguageOptionProps) {
  const settings = useSettingsStore((state) => state.settings)
  const isSelected = settings?.language === language
  const languageName =
    getTexts(`LANGUAGE_${language.replace('-', '').toUpperCase()}`) || language

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
      <LanguageFlag language={language} label={languageName} />

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
