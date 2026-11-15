import { RequestState } from '@/Components/Molecules/RequestState'
import { AccountIdentityLink } from '@/Components/Molecules/AccountIdentityLink'
import { ButtonLink } from '@/DesignSystem'
import { SocialPreviewPanel } from '@/Components/Molecules/SocialPreviewPanel'
import type { HomePageEntityPreviewProps } from './HomePageEntityPreview.types'
import './HomePageEntityPreview.style.scss'

export function HomePageEntityPreview({
  title,
  items,
  totalItems,
  emptyMessage,
  isLoading,
  isFetching,
  isError,
  onRetry,
  viewAllHref,
  viewAllLabel,
  getHref,
  getSecondary
}: HomePageEntityPreviewProps) {
  return (
    <SocialPreviewPanel
      title={title}
      count={totalItems}
      headerActions={
        viewAllHref && viewAllLabel ? (
          <ButtonLink variation="transparent" className="social-preview-panel__all" to={viewAllHref}>
            {viewAllLabel}
          </ButtonLink>
        ) : null
      }
    >
      <RequestState
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        isEmpty={!isLoading && !isError && items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={onRetry}
      >
        <div className="home-page__preview-list">
          {items.map((item) => (
            <AccountIdentityLink
              key={item.id}
              to={getHref(item)}
              name={item.name}
              picture={item.picture}
              secondary={getSecondary(item)}
              title={item.name}
              className="home-page__preview-entry account-card__profile-entry-identity"
              avatarClassName="home-page__preview-avatar account-card__profile-entry-avatar"
              copyClassName="home-page__preview-copy account-card__profile-entry-copy"
              nameClassName="account-card__link"
              secondaryClassName="account-card__profile-entry-secondary"
            />
          ))}
        </div>
      </RequestState>
    </SocialPreviewPanel>
  )
}
