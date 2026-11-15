import { ButtonLink } from '@/DesignSystem'
import { IdentityAvatarGrid } from '@/Components/Molecules/IdentityAvatarGrid'
import { RequestState } from '@/Components/Molecules/RequestState'
import { SocialPreviewPanel } from '@/Components/Organisms/SocialPreviewPanel'

import type { EntityAvatarPreviewProps } from './EntityAvatarPreview.types'

export function EntityAvatarPreview({
  title,
  totalItems,
  allHref,
  allLabel,
  isLoading,
  isFetching,
  isError,
  isEmpty,
  emptyMessage,
  onRetry,
  entries
}: EntityAvatarPreviewProps) {
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
        isEmpty={isEmpty}
        emptyMessage={emptyMessage}
        onRetry={onRetry}
      >
        <IdentityAvatarGrid entries={entries} />
      </RequestState>
    </SocialPreviewPanel>
  )
}
