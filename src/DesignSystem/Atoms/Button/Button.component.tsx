import type { ButtonHTMLAttributes } from 'react'

import './Button.style.scss'

type ButtonVariant = 'primary' | 'secondary' | 'cancel' | 'ghost'

type ButtonProps = {
  variant?: ButtonVariant
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classNames = ['button', variant, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  )
}
