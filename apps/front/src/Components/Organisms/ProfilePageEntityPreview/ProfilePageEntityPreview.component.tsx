import { ButtonLink } from '@/DesignSystem'
import { RequestState } from '@/Components/Molecules/RequestState'
import { IdentityAvatarGrid } from '@/Components/Molecules/IdentityAvatarGrid'
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
        <IdentityAvatarGrid entries={entries} />
      </RequestState>
    </SocialPreviewPanel>
  )
}
