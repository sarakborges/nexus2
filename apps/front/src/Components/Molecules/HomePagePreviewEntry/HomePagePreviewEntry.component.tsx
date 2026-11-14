import type { HomePagePreviewEntryProps } from './HomePagePreviewEntry.types'

import './HomePagePreviewEntry.style.scss'

import { AccountIdentityLink } from '@/Components'

export function HomePagePreviewEntry({
  name,
  picture,
  href,
  secondary
}: HomePagePreviewEntryProps) {
  return (
    <AccountIdentityLink
      to={href}
      name={name}
      picture={picture}
      secondary={secondary}
      title={name}
      className="home-page__preview-entry account-card__profile-entry-identity"
      avatarClassName="home-page__preview-avatar account-card__profile-entry-avatar"
      copyClassName="home-page__preview-copy account-card__profile-entry-copy"
      nameClassName="account-card__link"
      secondaryClassName="account-card__profile-entry-secondary"
    />
  )
}
