import { Link } from 'react-router'
import { ButtonLink } from '@/DesignSystem'
import { SocialPreviewPanel } from '@/Components/Molecules/SocialPreviewPanel'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { IdentityAvatar } from '@/Components/Molecules/IdentityAvatar'
import type { CommunityPageMembersPreviewProps } from './CommunityPageMembersPreview.types'
import './CommunityPageMembersPreview.style.scss'

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
        <div className="social-preview-grid">
          {members.map((member) => (
            <Link
              className="social-preview-link"
              key={member.id}
              to={ROUTES.profile + '/' + member.url}
              aria-label={member.name}
              title={member.name}
            >
              <IdentityAvatar className="social-preview-avatar" name={member.name} picture={member.picture} />
            </Link>
          ))}
        </div>
      </RequestState>
    </SocialPreviewPanel>
  )
}
