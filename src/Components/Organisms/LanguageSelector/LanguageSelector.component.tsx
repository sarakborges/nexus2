import { useId } from 'react'

import { SUPPORTED_LANGUAGES } from '@/Constants/languages'
import { useTranslations } from '@/Hooks/Language/useTranslations.hook'

import { Text } from '@/DesignSystem'
import { LanguageOption } from '@/Components/Molecules/LanguageOption'

import './LanguageSelector.style.scss'

export function LanguageSelector() {
  const titleId = useId()
  const { t } = useTranslations()

  return (
    <section
      className="language-selector"
      aria-labelledby={titleId}
    >
      <Text as="h2" id={titleId}>
        {t('LANGUAGES_TITLE')}
      </Text>

      <div className="language-selector__options">
        {SUPPORTED_LANGUAGES.map((language) => (
          <LanguageOption key={language} language={language} />
        ))}
      </div>
    </section>
  )
}
