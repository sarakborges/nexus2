import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import type { IdentityAvatarGridProps } from './IdentityAvatarGrid.types'

import './IdentityAvatarGrid.style.scss'

export function IdentityAvatarGrid({ entries }: IdentityAvatarGridProps) {
  return (
    <div className="identity-avatar-grid">
      {entries.map((entry) => (
        <Link
          className="identity-avatar-grid__link"
          key={entry.id}
          to={entry.href}
          aria-label={entry.name}
          title={entry.name}
        >
          <IdentityAvatar
            className="identity-avatar-grid__avatar"
            name={entry.name}
            picture={entry.picture}
          />
        </Link>
      ))}
    </div>
  )
}
