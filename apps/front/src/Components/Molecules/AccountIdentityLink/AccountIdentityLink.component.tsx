import type { AccountIdentityLinkProps } from './AccountIdentityLink.types'
import { IdentityAvatar } from '../IdentityAvatar'

import { Link } from 'react-router'


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
      <IdentityAvatar
        name={name}
        picture={picture}
        className={avatarClassName}
      />
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
