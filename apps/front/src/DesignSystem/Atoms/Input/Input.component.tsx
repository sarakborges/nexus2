import { forwardRef } from 'react'

import type { InputProps } from './Input.types'

import './Input.style.scss'

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, ...props }, ref) {
    const classNames = ['input', className].filter(Boolean).join(' ')

    return <input ref={ref} className={classNames} {...props} />
  }
)
