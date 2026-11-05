import { Link } from 'react-router'

import { IdentityAvatar, RequestState } from '@/Components'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useHomePage } from './useHomePage'

import './HomePage.style.scss'

export function HomePage() {
  const { t } = useTranslations()
  const {
    activityQuery,
    profilesQuery,
    friendsQuery,
    communitiesQuery,
    allCommunitiesQuery,
    ownedCommunityIdsQuery,
    currentProfile,
    activities,
    friends,
    communities,
    suggestions,
    formatDate
  } = useHomePage()

  const rightSidebar = (
    <div className="home-page__previews">
      <section className="social-preview-panel">
        <header className="social-preview-panel__header">
          <h2>
            {t('PROFILE_FRIENDS_TITLE')}
            <span className="social-preview-panel__count">
              ({friendsQuery.data?.totalItems ?? '—'})
            </span>
          </h2>
          {currentProfile && (
            <Link
              className="social-preview-panel__all"
              to={ROUTES.profile + '/' + currentProfile.url + '/friends'}
            >
              {t('PROFILE_FRIENDS_LINK')}
            </Link>
          )}
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
          {currentProfile && (
            <Link
              className="social-preview-panel__all"
              to={ROUTES.profile + '/' + currentProfile.url + '/communities'}
            >
              {t('PROFILE_COMMUNITIES_LINK')}
            </Link>
          )}
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
          isLoading={Boolean(
            currentProfile &&
            (allCommunitiesQuery.isLoading || ownedCommunityIdsQuery.isLoading)
          )}
          isFetching={
            allCommunitiesQuery.isFetching || ownedCommunityIdsQuery.isFetching
          }
          isError={
            allCommunitiesQuery.isError || ownedCommunityIdsQuery.isError
          }
          isEmpty={Boolean(
            currentProfile &&
            allCommunitiesQuery.isSuccess &&
            ownedCommunityIdsQuery.isSuccess &&
            suggestions.length === 0
          )}
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

  if (!currentProfile) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isLoading={profilesQuery.isLoading}
            isError={profilesQuery.isError}
            onRetry={() => void profilesQuery.refetch()}
          />
        </section>
      </main>
    )
  }

  return (
    <SocialPageLayout
      className="home-page"
      sidebar={
        <ProfileSidebar
          profile={currentProfile}
          active="home"
          showRelationshipActions={false}
        />
      }
      rightSidebar={rightSidebar}
    >
      <section className="social-panel home-page__card">
        <header className="social-panel__header">
          <div>
            <h1 className="social-panel__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">
              {t('HOME_ACTIVITY_DESCRIPTION')}
            </p>
          </div>
        </header>
        <section
          className="home-page__activity"
          aria-labelledby="home-activity-title"
        >
          <h2 className="home-page__activity-title" id="home-activity-title">
            {t('HOME_ACTIVITY_TITLE')}
          </h2>
          <RequestState
            isLoading={activityQuery.isLoading}
            isFetching={activityQuery.isFetching}
            isError={activityQuery.isError}
            isEmpty={activityQuery.isSuccess && activities.length === 0}
            emptyMessage={t('HOME_ACTIVITY_EMPTY')}
            onRetry={() => void activityQuery.refetch()}
          >
            <div className="home-page__activity-list">
              {activities.map((activity) => (
                <article className="home-page__activity-item" key={activity.id}>
                  <header className="home-page__activity-header">
                    <Link
                      className="home-page__activity-avatar-link"
                      to={ROUTES.profile + '/' + activity.profile.url}
                      aria-label={activity.profile.name}
                      title={activity.profile.name}
                    >
                      <IdentityAvatar
                        className="home-page__activity-avatar"
                        name={activity.profile.name}
                        picture={activity.profile.picture}
                      />
                    </Link>
                    <div className="home-page__activity-author">
                      <Link
                        className="home-page__activity-author-name"
                        to={ROUTES.profile + '/' + activity.profile.url}
                      >
                        {activity.profile.name}
                      </Link>
                      <time
                        dateTime={new Date(activity.updatedAt).toISOString()}
                      >
                        {formatDate(activity.updatedAt)}
                      </time>
                    </div>
                  </header>
                  {activity.type === 'friend_connected' ? (
                    <p className="home-page__activity-description">
                      <span>{t('HOME_ACTIVITY_PROFILE_PREFIX')} </span>
                      <Link to={ROUTES.profile + '/' + activity.profile.url}>
                        {activity.profile.name}
                      </Link>
                      <span> {t('HOME_ACTIVITY_FRIEND_CONNECTOR')} </span>
                      <Link to={ROUTES.profile + '/' + activity.friend.url}>
                        {activity.friend.name}
                      </Link>
                    </p>
                  ) : (
                    <p className="home-page__activity-description">
                      <span>{t('HOME_ACTIVITY_PROFILE_PREFIX')} </span>
                      <Link to={ROUTES.profile + '/' + activity.profile.url}>
                        {activity.profile.name}
                      </Link>
                      <span>
                        {' '}
                        {t(
                          activity.role === 'owner'
                            ? 'HOME_ACTIVITY_COMMUNITY_OWNER'
                            : activity.role === 'moderator'
                              ? 'HOME_ACTIVITY_COMMUNITY_MODERATOR'
                              : 'HOME_ACTIVITY_COMMUNITY_MEMBER'
                        )}{' '}
                      </span>
                      <Link
                        to={ROUTES.community + '/' + activity.community.url}
                      >
                        {activity.community.name}
                      </Link>
                    </p>
                  )}
                </article>
              ))}
            </div>
          </RequestState>
        </section>
      </section>
    </SocialPageLayout>
  )
}
