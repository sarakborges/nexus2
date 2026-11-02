import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getRecentActivity } from '@/Services/Activity'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'
import './HomePage.style.scss'

export function HomePage() {
  const { t } = useTranslations()
  const userId = useAuthStore(state => state.session?.user.id ?? null)
  const activityQuery = useQuery({
    queryKey: queryKeys.activity.recent(userId ?? ''),
    queryFn: getRecentActivity,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })
  const activities = activityQuery.data ?? []
  const formatDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)

  return (
    <main className="account-page home-page">
      <section className="account-card home-page__card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">{t('HOME_ACTIVITY_DESCRIPTION')}</p>
          </div>
        </header>

        <section className="home-page__activity" aria-labelledby="home-activity-title">
          <h2 className="home-page__activity-title" id="home-activity-title">{t('HOME_ACTIVITY_TITLE')}</h2>
          <RequestState
            isLoading={activityQuery.isLoading}
            isFetching={activityQuery.isFetching}
            isError={activityQuery.isError}
            isEmpty={activityQuery.isSuccess && activities.length === 0}
            emptyMessage={t('HOME_ACTIVITY_EMPTY')}
            onRetry={() => void activityQuery.refetch()}
          >
            <div className="home-page__activity-list">
              {activities.map(activity => (
                <article className="home-page__activity-item" key={activity.id}>
                  <div className="home-page__activity-meta">
                    <span>{activity.type === 'friend_connected' ? t('HOME_ACTIVITY_FRIEND_LABEL') : t('HOME_ACTIVITY_COMMUNITY_LABEL')}</span>
                    <time dateTime={new Date(activity.updatedAt).toISOString()}>{formatDate(activity.updatedAt)}</time>
                  </div>
                  {activity.type === 'friend_connected' ? (
                    <p className="home-page__activity-description">
                      <span>{t('HOME_ACTIVITY_PROFILE_PREFIX')} </span>
                      <Link to={ROUTES.profile + '/' + activity.profile.url}>{activity.profile.name}</Link>
                      <span> {t('HOME_ACTIVITY_FRIEND_CONNECTOR')} </span>
                      <Link to={ROUTES.profile + '/' + activity.friend.url}>{activity.friend.name}</Link>
                    </p>
                  ) : (
                    <p className="home-page__activity-description">
                      <span>{t('HOME_ACTIVITY_PROFILE_PREFIX')} </span>
                      <Link to={ROUTES.profile + '/' + activity.profile.url}>{activity.profile.name}</Link>
                      <span> {t(
                        activity.role === 'owner'
                          ? 'HOME_ACTIVITY_COMMUNITY_OWNER'
                          : activity.role === 'moderator'
                            ? 'HOME_ACTIVITY_COMMUNITY_MODERATOR'
                            : 'HOME_ACTIVITY_COMMUNITY_MEMBER'
                      )} </span>
                      <Link to={ROUTES.community + '/' + activity.community.url}>{activity.community.name}</Link>
                    </p>
                  )}
                </article>
              ))}
            </div>
          </RequestState>
        </section>
      </section>
    </main>
  )
}
