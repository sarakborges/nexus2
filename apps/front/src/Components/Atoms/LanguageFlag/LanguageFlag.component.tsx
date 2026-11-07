import type { LanguageFlagProps } from './LanguageFlag.types'
import { LANGUAGE_FLAG_PATHS } from '@/Constants/languages'
import { Portrait } from '@/DesignSystem'

import './LanguageFlag.style.scss'


export function LanguageFlag({ language }: LanguageFlagProps) {
  return (
    <span className="language-flag">
      <Portrait alt="" aria-hidden="true" src={LANGUAGE_FLAG_PATHS[language]} />
    </span>
  )
}
