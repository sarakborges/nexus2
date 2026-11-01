import type { JSX } from 'react'

import type { CharacterType } from '@/Types/Character.type'

export type DialogType = {
  speaker?: CharacterType

  text?: React.ReactNode

  image?: {
    src: string
    alt: string
  }

  content?: JSX.Element

  actions?: Array<{
    id: string
    text: string
    disabled?: boolean
    onClick: () => void
  }>
}
