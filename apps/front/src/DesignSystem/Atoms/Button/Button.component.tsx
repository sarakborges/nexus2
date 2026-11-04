import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import type { ButtonHTMLAttributes } from 'react'

import './Button.style.scss'

export type ButtonVariation = 'primary' | 'secondary' | 'cancel' | 'transparent'

type ButtonProps = {
  variation?: ButtonVariation
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  className,
  disabled = false,
  variation = 'primary',
  ...props
}: ButtonProps) {
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
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
