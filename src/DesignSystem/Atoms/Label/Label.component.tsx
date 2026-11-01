import type { LabelHTMLAttributes } from 'react'

import './Label.style.scss'

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

export function Label({ children, className, ...props }: LabelProps) {
  const classNames = ['label', className].filter(Boolean).join(' ')

  return (
    <label className={classNames} {...props}>
      {children}
    </label>
  )
}
