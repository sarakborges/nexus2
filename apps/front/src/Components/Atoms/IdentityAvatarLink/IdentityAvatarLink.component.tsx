import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import type { IdentityAvatarLinkProps } from './IdentityAvatarLink.types'

export function IdentityAvatarLink({
  to,
  name,
  picture,
  className,
  avatarClassName,
  ariaLabel,
  title
}: IdentityAvatarLinkProps) {
  return (
    <Link
      className={className}
      to={to}
      aria-label={ariaLabel ?? name}
      title={title ?? name}
    >
      <IdentityAvatar
        className={avatarClassName}
        name={name}
        picture={picture}
      />
    </Link>
  )
}
