import type { ReactNode } from 'react'
import { FaCheck } from 'react-icons/fa'
import { Button, Text } from '@/DesignSystem'

import './PreferenceOption.style.scss'

type PreferenceOptionProps = {
  label: string
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
  leadingVisual?: ReactNode
}

export function PreferenceOption({
  label,
  isSelected,
  onSelect,
  disabled = false,
  leadingVisual
}: PreferenceOptionProps) {
  return (
    <Button
      className="preference-option"
      type="button"
      variation="transparent"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
    >
      {leadingVisual}
      <Text className="preference-option__label">{label}</Text>
      {isSelected && (
        <FaCheck
          className="preference-option__selected-icon"
          aria-hidden="true"
        />
      )}
    </Button>
  )
}
