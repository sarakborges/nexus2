import { Input } from '@/DesignSystem/Atoms/Input'
import { Label } from '@/DesignSystem/Atoms/Label'

import type { FormFieldProps } from './FormField.types'

import './FormField.style.scss'

export function FormField({
  id,
  label,
  description,
  name = id,
  'aria-describedby': ariaDescribedBy,
  ...inputProps
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const describedBy = [ariaDescribedBy, descriptionId].filter(Boolean).join(' ') || undefined

  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} aria-describedby={describedBy} {...inputProps} />
      {description && (
        <p className="form-field__description" id={descriptionId}>
          {description}
        </p>
      )}
    </div>
  )
}
