import type { InputHTMLAttributes } from 'react'

export type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string
  label: string
}
