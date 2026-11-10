import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageFriendsPreviewProps } from './HomePageFriendsPreview.types'

export function HomePageFriendsPreview({
  profileUrl,
  homeQuery
}: HomePageFriendsPreviewProps) {
  const { t } = useTranslations()
  const friends = homeQuery.data?.friends.items ?? []

  return (
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>
          {t('PROFILE_FRIENDS_TITLE')}
          <span className="social-preview-panel__count">
            ({homeQuery.data?.friends.totalItems ?? '—'})
          </span>
        </h2>
        <Link
          className="social-preview-panel__all"
          to={ROUTES.profile + '/' + profileUrl + '/friends'}
        >
          {t('COMMON_VIEW_ALL')}
        </Link>
      </header>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && friends.length === 0}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__preview-list">
          {friends.map((friend) => (
            <HomePagePreviewEntry
              key={friend.id}
              name={friend.name}
              picture={friend.picture}
              href={ROUTES.profile + '/' + friend.url}
              secondary={'@' + friend.url}
            />
          ))}
        </div>
      </RequestState>
    </section>
  )
}
