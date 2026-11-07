import { Input } from '@/DesignSystem/Atoms/Input'
import { Label } from '@/DesignSystem/Atoms/Label'

import type { FormFieldProps } from './FormField.types'

import './FormField.style.scss'

export function FormField({
  id,
  label,
  name = id,
  ...inputProps
}: FormFieldProps) {
  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...inputProps} />
    </div>
  )
}
