import { RequestState } from '@/Components'
import { ButtonLink } from '@/DesignSystem'
import { SocialPreviewPanel } from '@/Components/Molecules/SocialPreviewPanel'
import { HomePagePreviewEntry } from '@/Components/Molecules/HomePagePreviewEntry'
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
            <HomePagePreviewEntry
              key={item.id}
              name={item.name}
              picture={item.picture}
              href={getHref(item)}
              secondary={getSecondary(item)}
            />
          ))}
        </div>
      </RequestState>
    </SocialPreviewPanel>
  )
}
