import { LANGUAGES } from '@/Consts/Languages.const'
import { getTexts } from '@/Helpers/Language'

import { Text } from '@/DesignSystem'
import { LanguageOption } from '@/Components/Molecules/LanguageOption'

import './LanguageSelector.style.scss'

export function LanguageSelector() {
  const title = getTexts('LANGUAGES_TITLE')

  return (
    <section className="language-selector" aria-label={title}>
      <Text>{title}</Text>

      <div className="language-selector__options">
        {LANGUAGES.map((language) => (
          <LanguageOption
            key={`language-selector-${language}`}
            language={language}
          />
        ))}
      </div>
    </section>
  )
}
