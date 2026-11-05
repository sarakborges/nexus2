import type { ReactNode } from 'react'

export type AccountIdentityLinkProps = {
  to: string
  name: string
  picture: string
  className: string
  avatarClassName: string
  copyClassName: string
  nameClassName: string
  secondary?: ReactNode
  secondaryClassName?: string
  children?: ReactNode
  title?: string
  ariaLabel?: string
}
