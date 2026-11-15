import type { BadgeProps } from './Badge.types'

import './Badge.style.scss'

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  const classNames = ['badge', `badge--${tone}`, className]
    .filter(Boolean)
    .join(' ')

  return <span className={classNames} {...props} />
}
