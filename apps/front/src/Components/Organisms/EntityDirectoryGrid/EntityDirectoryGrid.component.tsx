import { AccountIdentityLink } from '@/Components/Molecules/AccountIdentityLink'
import type { EntityDirectoryGridProps } from './EntityDirectoryGrid.types'

import './EntityDirectoryGrid.style.scss'

export function EntityDirectoryGrid({ entries }: EntityDirectoryGridProps) {
  return (
    <div className="account-card__profile-list account-card__profile-list--grid">
      {entries.map((entry) => (
        <article
          className="account-card__profile-entry account-card__profile-entry--card"
          key={entry.id}
        >
          <AccountIdentityLink
            to={entry.href}
            name={entry.name}
            picture={entry.picture}
            secondary={entry.secondaryText}
            className="account-card__profile-entry-identity"
            avatarClassName="account-card__profile-entry-avatar"
            copyClassName="account-card__profile-entry-copy"
            nameClassName="account-card__link"
            secondaryClassName="account-card__profile-entry-secondary"
            title={entry.name}
            ariaLabel={entry.name}
          />
          {entry.actions}
        </article>
      ))}
    </div>
  )
}
