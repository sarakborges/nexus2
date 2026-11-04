import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { RequestState } from '@/Components'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getRecentActivity } from '@/Services/Activity'
import { getCommunities, getProfileCommunities } from '@/Services/Community'
import { getProfilesByIds } from '@/Services/Profile'
import { getProfileFriends } from '@/Services/Relationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import './HomePage.style.scss'

type PreviewEntryProps = {
  name: string
  picture: string
  href: string
  secondary?: string
}

function PreviewEntry({ name, picture, href, secondary }: PreviewEntryProps) {
  return (
    <Link className="home-page__preview-entry account-card__profile-entry-identity" to={href}>
      <span className="home-page__preview-avatar account-card__profile-entry-avatar">
        {picture ? <img src={picture} alt="" /> : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
      </span>
      <span className="home-page__preview-copy account-card__profile-entry-copy">
        <span className="account-card__link">{name}</span>
        {secondary && <small className="account-card__profile-entry-secondary">{secondary}</small>}
      </span>
    </Link>
  )
}

export function HomePage() {
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const userId = session?.user.id ?? null
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null

  const activityQuery = useQuery({
    queryKey: queryKeys.activity.recent(userId ?? ''),
    queryFn: getRecentActivity,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })
  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
  const profiles = profilesQuery.data ?? []
  const currentProfile = profiles.find(profile => profile.id === currentProfileId) ?? profiles[0] ?? null
  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(currentProfile?.id ?? '', 1, 8),
    queryFn: () => getProfileFriends(currentProfile!.id, { page: 1, pageSize: 8 }),
    enabled: Boolean(currentProfile)
  })
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(currentProfile?.id ?? '', 1, 8),
    queryFn: () => getProfileCommunities(currentProfile!.id, { page: 1, pageSize: 8 }),
    enabled: Boolean(currentProfile)
  })
  const allCommunitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(1, 50),
    queryFn: () => getCommunities({ page: 1, pageSize: 50 }),
    enabled: Boolean(currentProfile)
  })
  const ownedCommunityIdsQuery = useQuery({
    queryKey: ['communities', 'owned-memberships', ...[...profileIds].sort()],
    queryFn: async () => {
      const memberships = await Promise.all(
        profileIds.map(profileId => getProfileCommunities(profileId, { page: 1, pageSize: 100 }))
      )
      return memberships.flatMap(result => result.items.map(community => community.id))
    },
    enabled: profileIds.length > 0,
    staleTime: 30 * 1000
  })

  const activities = activityQuery.data ?? []
  const friends = friendsQuery.data?.items ?? []
  const communities = communitiesQuery.data?.items ?? []
  const ownedCommunityIds = new Set(ownedCommunityIdsQuery.data ?? [])
  const suggestions = (allCommunitiesQuery.data?.items ?? [])
    .filter(community => community.type === currentProfile?.type && !ownedCommunityIds.has(community.id))
    .slice(0, 8)
  const formatDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)

  const rightSidebar = (
    <div className="home-page__previews">
      <section className="social-preview-panel">
        <header className="social-preview-panel__header">
          <h2>{t('PROFILE_FRIENDS_TITLE')}<span className="social-preview-panel__count">({friendsQuery.data?.totalItems ?? '—'})</span></h2>
          {currentProfile && <Link className="social-preview-panel__all" to={ROUTES.profile + '/' + currentProfile.url + '/friends'}>{t('PROFILE_FRIENDS_LINK')}</Link>}
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
            {friends.map(friend => <PreviewEntry key={friend.id} name={friend.name} picture={friend.picture} href={ROUTES.profile + '/' + friend.url} secondary={'@' + friend.url} />)}
          </div>
        </RequestState>
      </section>

      <section className="social-preview-panel">
        <header className="social-preview-panel__header">
          <h2>{t('PROFILE_COMMUNITIES_TITLE')}<span className="social-preview-panel__count">({communitiesQuery.data?.totalItems ?? '—'})</span></h2>
          {currentProfile && <Link className="social-preview-panel__all" to={ROUTES.profile + '/' + currentProfile.url + '/communities'}>{t('PROFILE_COMMUNITIES_LINK')}</Link>}
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
            {communities.map(community => <PreviewEntry key={community.id} name={community.name} picture={community.picture} href={ROUTES.community + '/' + community.url} secondary={'/community/' + community.url} />)}
          </div>
        </RequestState>
      </section>

      <section className="social-preview-panel">
        <header className="social-preview-panel__header">
          <h2>{t('HOME_SUGGESTED_COMMUNITIES')}</h2>
        </header>
        <RequestState
          isLoading={Boolean(currentProfile && (allCommunitiesQuery.isLoading || ownedCommunityIdsQuery.isLoading))}
          isFetching={allCommunitiesQuery.isFetching || ownedCommunityIdsQuery.isFetching}
          isError={allCommunitiesQuery.isError || ownedCommunityIdsQuery.isError}
          isEmpty={Boolean(currentProfile && allCommunitiesQuery.isSuccess && ownedCommunityIdsQuery.isSuccess && suggestions.length === 0)}
          emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
          onRetry={() => {
            void allCommunitiesQuery.refetch()
            void ownedCommunityIdsQuery.refetch()
          }}
        >
          <div className="home-page__preview-list">
            {suggestions.map(community => <PreviewEntry key={community.id} name={community.name} picture={community.picture} href={ROUTES.community + '/' + community.url} secondary={'/community/' + community.url} />)}
          </div>
        </RequestState>
      </section>
    </div>
  )

  if (!currentProfile) {
    return <main className="account-page"><section className="account-card"><RequestState isLoading={profilesQuery.isLoading} isError={profilesQuery.isError} onRetry={() => void profilesQuery.refetch()} /></section></main>
  }

  return (
    <SocialPageLayout
      className="home-page"
      sidebar={<ProfileSidebar profile={currentProfile} active="home" showRelationshipActions={false} />}
      rightSidebar={rightSidebar}
    >
      <section className="social-panel home-page__card">
        <header className="social-panel__header">
          <div>
            <h1 className="social-panel__title">{t('HOME_TITLE')}</h1>
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
                  <header className="home-page__activity-header">
                    <Link className="home-page__activity-avatar-link" to={ROUTES.profile + '/' + activity.profile.url} aria-label={activity.profile.name} title={activity.profile.name}>
                      <span className="home-page__activity-avatar">
                        {activity.profile.picture
                          ? <img src={activity.profile.picture} alt="" />
                          : <span aria-hidden="true">{activity.profile.name.trim().charAt(0).toUpperCase()}</span>}
                      </span>
                    </Link>
                    <div className="home-page__activity-author">
                      <Link className="home-page__activity-author-name" to={ROUTES.profile + '/' + activity.profile.url}>{activity.profile.name}</Link>
                      <time dateTime={new Date(activity.updatedAt).toISOString()}>{formatDate(activity.updatedAt)}</time>
                    </div>
                  </header>
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
    </SocialPageLayout>
  )
}
