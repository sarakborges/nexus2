import type { ReactNode } from 'react'

export type PreferenceOptionProps = {
  label: string
  description?: string
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
  leadingVisual?: ReactNode
}
