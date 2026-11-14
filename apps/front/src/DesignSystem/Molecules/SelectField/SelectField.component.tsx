import { Select } from '@/DesignSystem/Atoms/Select'
import { Label } from '@/DesignSystem/Atoms/Label'

import type { SelectFieldProps } from './SelectField.types'

import './SelectField.style.scss'

export function SelectField({ id, label, ...selectProps }: SelectFieldProps) {
  return (
    <div className="select-field">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} {...selectProps} />
    </div>
  )
}
