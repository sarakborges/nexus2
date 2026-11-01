import type { ImgHTMLAttributes } from 'react'

import './Portrait.style.scss'

type PortraitProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt'
> & {
  src: string
  alt: string
}

export function Portrait({ className, ...props }: PortraitProps) {
  const classNames = ['portrait', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <img {...props} />
    </div>
  )
}
