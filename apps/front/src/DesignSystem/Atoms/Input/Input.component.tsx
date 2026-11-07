import type { InputProps } from './Input.types'

import './Input.style.scss'

export function Input({ className, ...props }: InputProps) {
  const classNames = ['input', className].filter(Boolean).join(' ')

  return <input className={classNames} {...props} />
}
