import { RequestState } from '@/Components'
import { ButtonLink } from '@/DesignSystem'
import { HomePagePreviewEntry } from '@/Components/Molecules/HomePagePreviewEntry'
import type { HomePageEntityPreviewProps } from './HomePageEntityPreview.types'

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
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>
          {title}
          {totalItems !== undefined && (
            <span className="social-preview-panel__count">({totalItems})</span>
          )}
        </h2>
        {viewAllHref && viewAllLabel && (
          <ButtonLink
            variation="transparent"
            className="social-preview-panel__all"
            to={viewAllHref}
          >
            {viewAllLabel}
          </ButtonLink>
        )}
      </header>
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
    </section>
  )
}
