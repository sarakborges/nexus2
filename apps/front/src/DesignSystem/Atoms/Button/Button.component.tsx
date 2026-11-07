import type { ButtonProps } from './Button.types'
import { useGlobalRequestStatus } from '../../Hooks/useGlobalRequestStatus'

import './Button.style.scss'

export function Button({
  children,
  className,
  disabled = false,
  variation = 'primary',
  ...props
}: ButtonProps) {
  const isRequestPending = useGlobalRequestStatus()
  const classNames = ['button', `button--${variation}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classNames}
      disabled={disabled || isRequestPending}
      aria-busy={isRequestPending || undefined}
      {...props}
    >
      {children}
    </button>
  )
}
