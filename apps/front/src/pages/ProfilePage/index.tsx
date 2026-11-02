import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { AvatarUploadField, RelationshipActions, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfileCommunities } from '@/Services/Community'
import { getProfileByUrl } from '@/Services/Profile'
import { getProfileFriends } from '@/Services/Relationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'
import './ProfilePage.style.scss'

type PreviewAvatarProps = {
  name: string
  picture: string
}

function PreviewAvatar({ name, picture }: PreviewAvatarProps) {
  return (
    <span className="social-preview-avatar">
      {picture
        ? <img src={picture} alt="" />
        : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

export function ProfilePage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const session = useAuthStore(state => state.session)
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data

  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(profile?.id ?? '', 1, 16),
    queryFn: () => getProfileFriends(profile!.id, { page: 1, pageSize: 16 }),
    enabled: Boolean(profile?.id)
  })
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(profile?.id ?? '', 1, 16),
    queryFn: () => getProfileCommunities(profile!.id, { page: 1, pageSize: 16 }),
    enabled: Boolean(profile?.id)
  })

  if (!requestedUrl) return <NotFoundPage />
  if (profileQuery.isLoading) {
    return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  }
  if (profileQuery.isError) {
    return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void profileQuery.refetch()} /></div></main>
  }
  if (!profile) return <NotFoundPage />

  const friends = friendsQuery.data?.items ?? []
  const communities = communitiesQuery.data?.items ?? []
  const isOwner = session?.user.profiles.includes(profile.id) ?? false

  return (
    <main className="social-page social-page--profile">
      <RequestState isFetching={profileQuery.isFetching} />
      <div className="social-page__layout">
        <aside className="social-page__left-column">
          <div className="social-sidebar-card">
          <section className="social-identity">
            {profile.picture
              ? <img className="social-identity__picture social-identity__picture--profile" src={profile.picture} alt={t('PROFILE_PICTURE_ALT', { name: profile.name })} />
              : <div className="social-identity__picture social-identity__picture--fallback" aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</div>}
            <h1 className="social-identity__name">{profile.name}</h1>
            {session?.user.profiles.includes(profile.id) && (
              <AvatarUploadField
                label={t('PROFILE_PICTURE_LABEL')}
                value={profile.picture}
                fallbackName={profile.name}
                purpose="profile-avatar"
                targetId={profile.id}
                onChange={picture => queryClient.setQueryData(queryKeys.profiles.byUrl(profile.url), { ...profile, picture })}
                selectLabel={t('UPLOAD_SELECT_IMAGE')}
                changeLabel={t('UPLOAD_CHANGE_IMAGE')}
                removeLabel={t('UPLOAD_REMOVE_IMAGE')}
                uploadingLabel={t('UPLOAD_IN_PROGRESS')}
                errorLabel={t('UPLOAD_FAILED')}
                emptyLabel={t('UPLOAD_EMPTY')}
              />
            )}
            <RelationshipActions targetId={profile.id} />
          </section>

          <nav className="social-side-menu" aria-label={t('PROFILE_TITLE')}>
            <Link to={ROUTES.profile + '/' + profile.url} aria-current="page">{t('PROFILE_TITLE')}</Link>
            <Link to={ROUTES.profile + '/' + profile.url + '/friends'}>{t('PROFILE_FRIENDS_LINK')}</Link>
            <Link to={ROUTES.profile + '/' + profile.url + '/communities'}>{t('PROFILE_COMMUNITIES_LINK')}</Link>
            <Link to={ROUTES.profile + '/' + profile.url + '/messages'}>{t('PROFILE_MESSAGES_LINK')}</Link>
          </nav>
          {isOwner && (
            <Link className="social-sidebar-card__edit" to={ROUTES.profile + '/' + profile.url + '/edit'}>
              {t('PROFILE_EDIT')}
            </Link>
          )}
          </div>
        </aside>

        <section className="social-page__main-column">
          <article className="social-panel social-panel--about">
            <header className="social-panel__header">
              <div>
                <h2 className="social-panel__title">{t('PROFILE_ABOUT_LABEL')}</h2>
              </div>
            </header>
            {profile.about
              ? <div className="social-panel__body rich-text-content" dangerouslySetInnerHTML={{ __html: profile.about }} />
              : <p className="social-panel__body">{t('PROFILE_ABOUT_EMPTY')}</p>}
          </article>
        </section>

        <aside className="social-page__right-column">
          <section className="social-preview-panel">
            <header className="social-preview-panel__header">
              <h2>{t('PROFILE_FRIENDS_TITLE', { name: profile.name })}</h2>
              <div className="social-preview-panel__header-actions">
                <span>{friendsQuery.data?.totalItems ?? '—'}</span>
                <Link className="social-preview-panel__all" to={ROUTES.profile + '/' + profile.url + '/friends'}>{t('PROFILE_FRIENDS_LINK')}</Link>
              </div>
            </header>
            <RequestState
              isLoading={friendsQuery.isLoading}
              isFetching={friendsQuery.isFetching}
              isError={friendsQuery.isError}
              isEmpty={friendsQuery.isSuccess && friends.length === 0}
              emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
              onRetry={() => void friendsQuery.refetch()}
            >
              <div className="social-preview-grid">
                {friends.map(friend => (
                  <Link className="social-preview-link" key={friend.id} to={ROUTES.profile + '/' + friend.url} aria-label={friend.name} title={friend.name}>
                    <PreviewAvatar name={friend.name} picture={friend.picture} />
                  </Link>
                ))}
              </div>
            </RequestState>
          </section>

          <section className="social-preview-panel">
            <header className="social-preview-panel__header">
              <h2>{t('PROFILE_COMMUNITIES_TITLE', { name: profile.name })}</h2>
              <div className="social-preview-panel__header-actions">
                <span>{communitiesQuery.data?.totalItems ?? '—'}</span>
                <Link className="social-preview-panel__all" to={ROUTES.profile + '/' + profile.url + '/communities'}>{t('PROFILE_COMMUNITIES_LINK')}</Link>
              </div>
            </header>
            <RequestState
              isLoading={communitiesQuery.isLoading}
              isFetching={communitiesQuery.isFetching}
              isError={communitiesQuery.isError}
              isEmpty={communitiesQuery.isSuccess && communities.length === 0}
              emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
              onRetry={() => void communitiesQuery.refetch()}
            >
              <div className="social-preview-grid">
                {communities.map(community => (
                  <Link className="social-preview-link" key={community.id} to={ROUTES.community + '/' + community.url} aria-label={community.name} title={community.name}>
                    <PreviewAvatar name={community.name} picture={community.picture} />
                  </Link>
                ))}
              </div>
            </RequestState>
          </section>
        </aside>
      </div>
    </main>
  )
}
