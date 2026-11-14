import { Select } from '@/DesignSystem/Atoms/Select'
import { Label } from '@/DesignSystem/Atoms/Label'

import type { SelectFieldProps } from './SelectField.types'

import './SelectField.style.scss'

export function SelectField({
  id,
  label,
  containerClassName,
  ...selectProps
}: SelectFieldProps) {
  const classNames = ['select-field', containerClassName]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames}>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} {...selectProps} />
    </div>
  )
}
