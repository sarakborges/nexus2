import type { PortraitProps } from './Portrait.types'

import './Portrait.style.scss'

export function Portrait({ className, ...props }: PortraitProps) {
  const classNames = ['portrait', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <img {...props} />
    </div>
  )
}
