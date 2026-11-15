import type { AccountIdentityLinkProps } from './AccountIdentityLink.types'
import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'

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
  trailing,
  title,
  ariaLabel,
  onClick
}: AccountIdentityLinkProps) {
  return (
    <Link className={className} to={to} title={title} aria-label={ariaLabel} onClick={onClick}>
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
      {trailing}
    </Link>
  )
}
