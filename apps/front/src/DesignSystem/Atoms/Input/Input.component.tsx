import type { InputHTMLAttributes } from 'react'

import './Input.style.scss'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  const classNames = ['input', className].filter(Boolean).join(' ')

  return <input className={classNames} {...props} />
}
