import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityPageForumPreviewProps } from './CommunityPageForumPreview.types'

export function CommunityPageForumPreview({
  communityUrl,
  communityPageQuery,
  canViewMembers,
  topics,
  authorsById
}: CommunityPageForumPreviewProps) {
  const { t } = useTranslations()

  return (
    <section className="community-forum social-page__content-stack community-page__forum">
      <header className="account-card__header">
        <h2 className="account-card__title">{t('FORUM_TITLE')}</h2>
        <Link to={ROUTES.community + '/' + communityUrl + '/forum'}>
          {t('FORUM_VIEW_ALL')}
        </Link>
      </header>
      <RequestState
        isLoading={communityPageQuery.isLoading}
        isFetching={communityPageQuery.isFetching}
        isError={communityPageQuery.isError}
        isEmpty={communityPageQuery.isSuccess && topics.length === 0}
        emptyMessage={
          canViewMembers
            ? t('FORUM_EMPTY')
            : t('COMMUNITY_PRIVATE_RESTRICTED')
        }
        onRetry={() => void communityPageQuery.refetch()}
      >
        <CommunityForumTopicList
          communityUrl={communityUrl}
          topics={topics}
          authorsById={authorsById}
        />
      </RequestState>
    </section>
  )
}
