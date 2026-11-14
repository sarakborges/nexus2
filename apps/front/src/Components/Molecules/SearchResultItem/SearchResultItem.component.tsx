import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Molecules/IdentityAvatar'
import type { SearchResultItemProps } from './SearchResultItem.types'

import './SearchResultItem.style.scss'

export function SearchResultItem({
  name,
  picture,
  address,
  href,
  about,
  kindLabel
}: SearchResultItemProps) {
  return (
    <article className="search-result">
      <Link className="search-result__link" to={href}>
        <IdentityAvatar
          className="search-result__avatar"
          name={name}
          picture={picture}
        />
        <span className="search-result__copy">
          <strong>{name}</strong>
          <span className="search-result__address">{address}</span>
          {about && (
            <span className="search-result__about">{about}</span>
          )}
        </span>
        <span className="search-result__kind">{kindLabel}</span>
      </Link>
    </article>
  )
}
