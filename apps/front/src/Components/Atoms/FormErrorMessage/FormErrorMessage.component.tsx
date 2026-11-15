import type { FormErrorMessageProps } from './FormErrorMessage.types'

import './FormErrorMessage.style.scss'

export function FormErrorMessage({ children }: FormErrorMessageProps) {
  return (
    <p className="form-error-message" role="alert">
      {children}
    </p>
  )
}
