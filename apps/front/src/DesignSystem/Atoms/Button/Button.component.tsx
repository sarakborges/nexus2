import type { ButtonProps } from './Button.types'

import './Button.style.scss'

export function Button({
  children,
  className,
  disabled = false,
  variation = 'primary',
  ...props
}: ButtonProps) {
  const classNames = ['button', `button--${variation}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classNames} disabled={disabled} {...props}>
      {children}
    </button>
  )
}
