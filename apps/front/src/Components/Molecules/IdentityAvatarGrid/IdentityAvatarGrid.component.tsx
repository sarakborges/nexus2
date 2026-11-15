import { IdentityAvatarLink } from '@/Components/Atoms/IdentityAvatarLink'
import type { IdentityAvatarGridProps } from './IdentityAvatarGrid.types'

import './IdentityAvatarGrid.style.scss'

export function IdentityAvatarGrid({ entries }: IdentityAvatarGridProps) {
  return (
    <div className="identity-avatar-grid">
      {entries.map(entry => (
        <IdentityAvatarLink
          key={entry.id}
          className="identity-avatar-grid__link"
          to={entry.href}
          name={entry.name}
          picture={entry.picture}
          avatarClassName="identity-avatar-grid__avatar"
        />
      ))}
    </div>
  )
}
