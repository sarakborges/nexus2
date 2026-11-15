import { ButtonLink } from '@/DesignSystem'
import { RequestState } from '@/Components/Molecules/RequestState'
import { IdentityAvatarGrid } from '@/Components/Molecules/IdentityAvatarGrid'
import { SocialPreviewPanel } from '@/Components/Molecules/SocialPreviewPanel'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityPageMembersPreviewProps } from './CommunityPageMembersPreview.types'

export function CommunityPageMembersPreview({
  communityUrl,
  communityPageQuery,
  canViewMembers,
  members,
  memberCount
}: CommunityPageMembersPreviewProps) {
  const { t } = useTranslations()

  return (
    <SocialPreviewPanel
      title={t('COMMUNITY_MEMBERS_TITLE')}
      count={memberCount ?? '—'}
      headerActions={
        <ButtonLink
          variation="transparent"
          className="social-preview-panel__all"
          to={ROUTES.community + '/' + communityUrl + '/members'}
        >
          {t('COMMON_VIEW_ALL')}
        </ButtonLink>
      }
    >
      <RequestState
        isLoading={communityPageQuery.isLoading}
        isFetching={communityPageQuery.isFetching}
        isError={communityPageQuery.isError}
        isEmpty={!canViewMembers || (communityPageQuery.isSuccess && members.length === 0)}
        emptyMessage={
          canViewMembers
            ? t('COMMUNITY_MEMBERS_EMPTY')
            : t('COMMUNITY_PRIVATE_RESTRICTED')
        }
        onRetry={() => void communityPageQuery.refetch()}
      >
        <IdentityAvatarGrid
          entries={members.map((member) => ({
            id: member.id,
            href: ROUTES.profile + '/' + member.url,
            name: member.name,
            picture: member.picture
          }))}
        />
      </RequestState>
    </SocialPreviewPanel>
  )
}
