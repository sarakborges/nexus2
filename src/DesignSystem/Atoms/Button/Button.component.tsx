import type { ButtonHTMLAttributes } from 'react'

import './Button.style.scss'

export type ButtonVariation =
  | 'primary'
  | 'secondary'
  | 'cancel'
  | 'transparent'

type ButtonProps = {
  variation?: ButtonVariation
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  className,
  variation = 'primary',
  ...props
}: ButtonProps) {
  const classNames = ['button', `button--${variation}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  )
}
