import { Portrait } from '@/DesignSystem'

import './LanguageFlag.style.scss'

type LanguageFlagProps = {
  language: string
  label: string
}

export function LanguageFlag({ language, label }: LanguageFlagProps) {
  return (
    <span className="language-flag">
      <Portrait alt={label} src={`/languages/${language}.webp`} />
    </span>
  )
}
