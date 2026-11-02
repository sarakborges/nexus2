import type { ReactNode } from 'react'
import { useId } from 'react'
import { Text } from '@/DesignSystem'

import './PreferenceSelector.style.scss'

type PreferenceSelectorProps = {
  title: string
  children: ReactNode
}

export function PreferenceSelector({ title, children }: PreferenceSelectorProps) {
  const titleId = useId()

  return (
    <section className="preference-selector" aria-labelledby={titleId}>
      <Text as="h2" id={titleId}>
        {title}
      </Text>
      <div className="preference-selector__options">{children}</div>
    </section>
  )
}
