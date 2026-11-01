import type { Language } from '@/Constants/languages'
import { Portrait } from '@/DesignSystem'

import './LanguageFlag.style.scss'

type LanguageFlagProps = {
  language: Language
}

export function LanguageFlag({ language }: LanguageFlagProps) {
  return (
    <span className="language-flag">
      <Portrait alt="" aria-hidden="true" src={`/languages/${language}.webp`} />
    </span>
  )
}
