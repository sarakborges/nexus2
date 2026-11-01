import type { InputHTMLAttributes } from 'react'

import { Input } from '@/DesignSystem/Atoms/Input'
import { Label } from '@/DesignSystem/Atoms/Label'

import './FormField.style.scss'

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string
  label: string
}

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
