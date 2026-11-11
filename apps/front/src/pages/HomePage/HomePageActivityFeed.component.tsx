import { Link } from 'react-router'

import { IdentityAvatar, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { HomePageActivityFeedProps } from './HomePageActivityFeed.types'

export function HomePageActivityFeed({
  homeQuery,
  activities,
  formatDate
}: HomePageActivityFeedProps) {
  const { t } = useTranslations()

  return (
    <section
      className="home-page__activity"
      aria-labelledby="home-activity-title"
    >
      <h2 className="home-page__activity-title" id="home-activity-title">
        {t('HOME_ACTIVITY_TITLE')}
      </h2>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && activities.length === 0}
        emptyMessage={t('HOME_ACTIVITY_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
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
                  <time dateTime={new Date(activity.updatedAt).toISOString()}>
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
                  <Link to={ROUTES.community + '/' + activity.community.url}>
                    {activity.community.name}
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>
      </RequestState>
    </section>
  )
}
