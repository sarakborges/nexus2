import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { PreviewAvatar } from './PreviewAvatar.component'
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
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>
          {t('COMMUNITY_MEMBERS_TITLE')}
          <span className="social-preview-panel__count">
            ({memberCount ?? '—'})
          </span>
        </h2>
        <Link
          className="social-preview-panel__all"
          to={ROUTES.community + '/' + communityUrl + '/members'}
        >
          {t('COMMUNITY_MEMBERS_LINK')}
        </Link>
      </header>
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
              <PreviewAvatar name={member.name} picture={member.picture} />
            </Link>
          ))}
        </div>
      </RequestState>
    </section>
  )
}
