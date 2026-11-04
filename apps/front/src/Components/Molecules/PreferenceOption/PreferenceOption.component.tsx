import { FaCheck } from 'react-icons/fa'

import type { ReactNode } from 'react'

import { Button, Text } from '@/DesignSystem'

import './PreferenceOption.style.scss'

type PreferenceOptionProps = {
  label: string
  description?: string
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
  leadingVisual?: ReactNode
}

export function PreferenceOption({
  label,
  description,
  isSelected,
  onSelect,
  disabled = false,
  leadingVisual
}: PreferenceOptionProps) {
  return (
    <Button
      className={[
        'preference-option',
        isSelected ? 'preference-option--selected' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      variation="transparent"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
    >
      {leadingVisual}
      <span className="preference-option__content">
        <Text className="preference-option__label">{label}</Text>
        {description && (
          <span className="preference-option__description">{description}</span>
        )}
      </span>
      {isSelected && (
        <FaCheck
          className="preference-option__selected-icon"
          aria-hidden="true"
        />
      )}
    </Button>
  )
}
