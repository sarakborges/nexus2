import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { RequestState } from '@/Components'
import { ProfileSidebar, SocialPageLayout, SuggestedCommunities } from '@/Components/Organisms'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getRecentActivity } from '@/Services/Activity'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'
import './HomePage.style.scss'

export function HomePage() {
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const userId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const currentProfileQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(currentProfileId ? [currentProfileId] : []),
    queryFn: () => getProfilesByIds([currentProfileId!]),
    enabled: Boolean(currentProfileId),
    staleTime: 5 * 60 * 1000
  })
  const activityQuery = useQuery({
    queryKey: queryKeys.activity.recent(userId ?? ''),
    queryFn: getRecentActivity,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })
  const profile = currentProfileQuery.data?.[0]
  const activities = activityQuery.data ?? []
  const formatDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)

  return (
    <SocialPageLayout
      className="social-page--feed"
      sidebar={profile
        ? <ProfileSidebar profile={profile} />
        : <section className="social-sidebar-card social-sidebar-card--empty"><p>{t('HOME_PROFILES_EMPTY')}</p><Link to={ROUTES.createProfile}>{t('HOME_CREATE_PROFILE')}</Link></section>}
      aside={<SuggestedCommunities />}
    >
      <header className="social-directory-header home-feed-header">
        <div>
          <h1>{t('HOME_TITLE')}</h1>
          <p>{t('HOME_ACTIVITY_DESCRIPTION')}</p>
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
              <article className="home-feed-card" key={activity.id}>
                <header className="home-feed-card__header">
                  <Link className="home-feed-card__author" to={ROUTES.profile + '/' + activity.profile.url}>
                    <span className="home-feed-card__avatar">
                      {activity.profile.picture
                        ? <img src={activity.profile.picture} alt="" />
                        : <span aria-hidden="true">{activity.profile.name.trim().charAt(0).toUpperCase()}</span>}
                    </span>
                    <span className="home-feed-card__author-copy">
                      <strong>{activity.profile.name}</strong>
                      <span>{activity.type === 'friend_connected' ? t('HOME_ACTIVITY_FRIEND_LABEL') : t('HOME_ACTIVITY_COMMUNITY_LABEL')}</span>
                    </span>
                  </Link>
                  <time dateTime={new Date(activity.updatedAt).toISOString()}>{formatDate(activity.updatedAt)}</time>
                </header>
                {activity.type === 'friend_connected' ? (
                  <p className="home-feed-card__description">
                    <span>{t('HOME_ACTIVITY_FRIEND_CONNECTOR')} </span>
                    <Link to={ROUTES.profile + '/' + activity.friend.url}>{activity.friend.name}</Link>
                  </p>
                ) : (
                  <p className="home-feed-card__description">
                    <span>{t(
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
    </SocialPageLayout>
  )
}
