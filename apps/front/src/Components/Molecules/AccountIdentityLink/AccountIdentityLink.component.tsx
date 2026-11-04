import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { IdentityAvatar } from '../IdentityAvatar'

type AccountIdentityLinkProps = {
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

export function AccountIdentityLink({
  to,
  name,
  picture,
  className,
  avatarClassName,
  copyClassName,
  nameClassName,
  secondary,
  secondaryClassName,
  children,
  title,
  ariaLabel
}: AccountIdentityLinkProps) {
  return (
    <Link className={className} to={to} title={title} aria-label={ariaLabel}>
      <IdentityAvatar name={name} picture={picture} className={avatarClassName} />
      <span className={copyClassName}>
        <span className={nameClassName}>{name}</span>
        {secondary !== undefined && (
          <span className={secondaryClassName}>{secondary}</span>
        )}
        {children}
      </span>
    </Link>
  )
}
