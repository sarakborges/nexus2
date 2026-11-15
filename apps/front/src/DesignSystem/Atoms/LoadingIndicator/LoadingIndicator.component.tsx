import type { LoadingIndicatorProps } from './LoadingIndicator.types'

import './LoadingIndicator.style.scss'

export function LoadingIndicator({ size = 'medium', className }: LoadingIndicatorProps) {
  const classNames = ['loading-indicator', `loading-indicator--${size}`, className]
    .filter(Boolean)
    .join(' ')

  return <span className={classNames} aria-hidden="true" />
}
