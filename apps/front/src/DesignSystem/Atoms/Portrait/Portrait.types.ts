import type { ImgHTMLAttributes } from 'react'

export type PortraitProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt'
> & {
  src: string
  alt: string
}
