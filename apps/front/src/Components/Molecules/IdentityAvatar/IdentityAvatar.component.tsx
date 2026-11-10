import type { IdentityAvatarProps } from './IdentityAvatar.types'
import './IdentityAvatar.style.scss'

export function IdentityAvatar({
  name,
  picture,
  className,
  imageClassName
}: IdentityAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase()

  return (
    <span className={['identity-avatar', className].filter(Boolean).join(' ')}>
      {picture ? (
        <img
          className={['identity-avatar__image', imageClassName]
            .filter(Boolean)
            .join(' ')}
          src={picture}
          alt=""
        />
      ) : (
        <span className="identity-avatar__initial" aria-hidden="true">
          {initial}
        </span>
      )}
    </span>
  )
}
