import { SUPPORTED_LANGUAGES } from '@/Constants/languages'
import { useTranslations } from '@/Hooks/Language/useTranslations.hook'

import { Text } from '@/DesignSystem'
import { LanguageOption } from '@/Components/Molecules/LanguageOption'

import './LanguageSelector.style.scss'

export function LanguageSelector() {
  const { t } = useTranslations()

  return (
    <section
      className="language-selector"
      aria-labelledby="language-selector-title"
    >
      <Text as="h2" id="language-selector-title">
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
