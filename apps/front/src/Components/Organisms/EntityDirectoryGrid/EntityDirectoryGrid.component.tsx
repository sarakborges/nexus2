import { Link } from 'react-router'

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
          <Link
            className="account-card__profile-entry-identity"
            to={entry.href}
          >
            <span className="account-card__profile-entry-avatar">
              {entry.picture ? (
                <img src={entry.picture} alt="" />
              ) : (
                <span aria-hidden="true">
                  {entry.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="account-card__profile-entry-copy">
              <span className="account-card__link">{entry.name}</span>
              <span className="account-card__profile-entry-secondary">
                {entry.secondaryText}
              </span>
            </span>
          </Link>
          {entry.actions}
        </article>
      ))}
    </div>
  )
}
