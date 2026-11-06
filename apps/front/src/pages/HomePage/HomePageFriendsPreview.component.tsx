import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageFriendsPreviewProps } from './HomePageFriendsPreview.types'

export function HomePageFriendsPreview({
  profileUrl,
  friendsQuery,
  friends
}: HomePageFriendsPreviewProps) {
  const { t } = useTranslations()

  return (
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>
          {t('PROFILE_FRIENDS_TITLE')}
          <span className="social-preview-panel__count">
            ({friendsQuery.data?.totalItems ?? '—'})
          </span>
        </h2>
        <Link
          className="social-preview-panel__all"
          to={ROUTES.profile + '/' + profileUrl + '/friends'}
        >
          {t('PROFILE_FRIENDS_LINK')}
        </Link>
      </header>
      <RequestState
        isLoading={friendsQuery.isLoading}
        isFetching={friendsQuery.isFetching}
        isError={friendsQuery.isError}
        isEmpty={friendsQuery.isSuccess && friends.length === 0}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        onRetry={() => void friendsQuery.refetch()}
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
