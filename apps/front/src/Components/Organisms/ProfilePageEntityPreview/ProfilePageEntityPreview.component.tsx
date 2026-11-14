import { Link } from 'react-router'

import { IdentityAvatar, RequestState } from '@/Components'
import { ButtonLink } from '@/DesignSystem'
import { SocialPreviewPanel } from '@/Components/Molecules/SocialPreviewPanel'
import type { ProfilePageEntityPreviewProps } from './ProfilePageEntityPreview.types'

export function ProfilePageEntityPreview({
  title,
  totalItems,
  allHref,
  allLabel,
  isLoading,
  isFetching,
  isError,
  isSuccess,
  emptyMessage,
  onRetry,
  entries
}: ProfilePageEntityPreviewProps) {
  return (
    <SocialPreviewPanel
      title={title}
      count={totalItems ?? '—'}
      headerActions={
        <ButtonLink
          variation="transparent"
          className="social-preview-panel__all"
          to={allHref}
        >
          {allLabel}
        </ButtonLink>
      }
    >
      <RequestState
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        isEmpty={isSuccess && entries.length === 0}
        emptyMessage={emptyMessage}
        onRetry={onRetry}
      >
        <div className="social-preview-grid">
          {entries.map((entry) => (
            <Link
              className="social-preview-link"
              key={entry.id}
              to={entry.href}
              aria-label={entry.name}
              title={entry.name}
            >
              <IdentityAvatar
                className="social-preview-avatar"
                name={entry.name}
                picture={entry.picture}
              />
            </Link>
          ))}
        </div>
      </RequestState>
    </SocialPreviewPanel>
  )
}
