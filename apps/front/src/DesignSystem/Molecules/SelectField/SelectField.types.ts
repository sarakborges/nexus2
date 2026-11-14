import type { SelectHTMLAttributes } from 'react'

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id: string
  label: string
  containerClassName?: string
}
