import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageRightSidebarProps } from './HomePageRightSidebar.types'

export function HomePageRightSidebar({
  currentProfile,
  friendsQuery,
  communitiesQuery,
  allCommunitiesQuery,
  ownedCommunityIdsQuery,
  friends,
  communities,
  suggestions
}: HomePageRightSidebarProps) {
  const { t } = useTranslations()

  return (
    <div className="home-page__previews">
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
            to={ROUTES.profile + '/' + currentProfile.url + '/friends'}
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

      <section className="social-preview-panel">
        <header className="social-preview-panel__header">
          <h2>
            {t('PROFILE_COMMUNITIES_TITLE')}
            <span className="social-preview-panel__count">
              ({communitiesQuery.data?.totalItems ?? '—'})
            </span>
          </h2>
          <Link
            className="social-preview-panel__all"
            to={ROUTES.profile + '/' + currentProfile.url + '/communities'}
          >
            {t('PROFILE_COMMUNITIES_LINK')}
          </Link>
        </header>
        <RequestState
          isLoading={communitiesQuery.isLoading}
          isFetching={communitiesQuery.isFetching}
          isError={communitiesQuery.isError}
          isEmpty={communitiesQuery.isSuccess && communities.length === 0}
          emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
          onRetry={() => void communitiesQuery.refetch()}
        >
          <div className="home-page__preview-list">
            {communities.map((community) => (
              <HomePagePreviewEntry
                key={community.id}
                name={community.name}
                picture={community.picture}
                href={ROUTES.community + '/' + community.url}
                secondary={'/community/' + community.url}
              />
            ))}
          </div>
        </RequestState>
      </section>

      <section className="social-preview-panel">
        <header className="social-preview-panel__header">
          <h2>{t('HOME_SUGGESTED_COMMUNITIES')}</h2>
        </header>
        <RequestState
          isLoading={
            allCommunitiesQuery.isLoading || ownedCommunityIdsQuery.isLoading
          }
          isFetching={
            allCommunitiesQuery.isFetching || ownedCommunityIdsQuery.isFetching
          }
          isError={
            allCommunitiesQuery.isError || ownedCommunityIdsQuery.isError
          }
          isEmpty={
            allCommunitiesQuery.isSuccess &&
            ownedCommunityIdsQuery.isSuccess &&
            suggestions.length === 0
          }
          emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
          onRetry={() => {
            void allCommunitiesQuery.refetch()
            void ownedCommunityIdsQuery.refetch()
          }}
        >
          <div className="home-page__preview-list">
            {suggestions.map((community) => (
              <HomePagePreviewEntry
                key={community.id}
                name={community.name}
                picture={community.picture}
                href={ROUTES.community + '/' + community.url}
                secondary={'/community/' + community.url}
              />
            ))}
          </div>
        </RequestState>
      </section>
    </div>
  )
}
