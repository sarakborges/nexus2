import type { ReactNode } from 'react'

import './FormErrorMessage.style.scss'

export type FormErrorMessageProps = {
  children: ReactNode
}

export function FormErrorMessage({ children }: FormErrorMessageProps) {
  return (
    <p className="form-error-message" role="alert">
      {children}
    </p>
  )
}
