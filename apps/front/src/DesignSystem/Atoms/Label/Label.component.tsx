import type { LabelProps } from './Label.types'

import './Label.style.scss'

export function Label({ children, className, ...props }: LabelProps) {
  const classNames = ['label', className].filter(Boolean).join(' ')

  return (
    <label className={classNames} {...props}>
      {children}
    </label>
  )
}
