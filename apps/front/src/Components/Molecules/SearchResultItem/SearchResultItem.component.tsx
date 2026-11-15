import { AccountIdentityLink } from '@/Components/Molecules/AccountIdentityLink'
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
      <AccountIdentityLink
        to={href}
        name={name}
        picture={picture}
        secondary={address}
        className="search-result__link"
        avatarClassName="search-result__avatar"
        copyClassName="search-result__copy"
        nameClassName="search-result__name"
        secondaryClassName="search-result__address"
        trailing={<span className="search-result__kind">{kindLabel}</span>}
        title={name}
        ariaLabel={name}
      >
        {about && <span className="search-result__about">{about}</span>}
      </AccountIdentityLink>
    </article>
  )
}
