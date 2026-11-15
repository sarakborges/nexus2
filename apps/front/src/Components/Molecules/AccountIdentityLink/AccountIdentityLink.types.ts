import type { MouseEventHandler, ReactNode } from 'react'

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
  trailing?: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
  title?: string
  ariaLabel?: string
}
