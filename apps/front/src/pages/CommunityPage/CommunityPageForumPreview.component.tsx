import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityPageForumPreviewProps } from './CommunityPageForumPreview.types'

export function CommunityPageForumPreview({
  communityUrl,
  topicsQuery,
  authorsQuery,
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
        isLoading={topicsQuery.isLoading || authorsQuery.isLoading}
        isFetching={topicsQuery.isFetching || authorsQuery.isFetching}
        isError={topicsQuery.isError || authorsQuery.isError}
        isEmpty={topicsQuery.isSuccess && topicsQuery.data.totalItems === 0}
        emptyMessage={t('FORUM_EMPTY')}
        onRetry={() => {
          void topicsQuery.refetch()
          void authorsQuery.refetch()
        }}
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
