import { useQuery } from '@tanstack/react-query'

import { Link, useNavigate, useParams } from 'react-router'

import { IdentityAvatar, RequestState } from '@/Components'
import { ProfileSidebar } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { getProfileCommunities } from '@/Services/Community'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getProfileFriends } from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'
import './ProfilePage.style.scss'

function PreviewAvatar({ name, picture }: { name: string; picture: string }) {
  return (
    <IdentityAvatar
      className="social-preview-avatar"
      name={name}
      picture={picture}
    />
  )
}

export function ProfilePage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const canInteract =
    !session ||
    (typeCompatibility.isCompatible && !typeCompatibility.isChecking)

  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(profile?.id ?? '', 1, 16),
    queryFn: () => getProfileFriends(profile!.id, { page: 1, pageSize: 16 }),
    enabled: Boolean(profile?.id)
  })
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(profile?.id ?? '', 1, 16),
    queryFn: () =>
      getProfileCommunities(profile!.id, { page: 1, pageSize: 16 }),
    enabled: Boolean(profile?.id)
  })

  if (!requestedUrl) return <NotFoundPage />
  if (profileQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (profileQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isError onRetry={() => void profileQuery.refetch()} />
        </div>
      </main>
    )
  }
  if (!profile) return <NotFoundPage />

  const friends = friendsQuery.data?.items ?? []
  const communities = communitiesQuery.data?.items ?? []
  const isOwner = session?.user.profiles.includes(profile.id) ?? false

  return (
    <main className="social-page social-page--profile">
      <div className="social-page__layout">
        <aside className="social-page__left-column">
          <ProfileSidebar
            profile={profile}
            active="profile"
            showRelationshipActions={canInteract}
          />
        </aside>

        <section className="social-page__main-column">
          <RequestState isFetching={profileQuery.isFetching} />
          {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
            <p className="profile-type-notice" role="alert">
              {t('PROFILE_TYPE_MISMATCH_NOTICE')}
            </p>
          )}
          <article className="social-panel social-panel--about">
            <header className="social-panel__header">
              <div>
                <h2 className="social-panel__title">
                  {t('PROFILE_ABOUT_LABEL')}
                </h2>
              </div>
              {isOwner && canInteract && (
                <Button
                  type="button"
                  variation="primary"
                  onClick={() =>
                    navigate(ROUTES.profile + '/' + profile.url + '/edit')
                  }
                >
                  {t('PROFILE_EDIT')}
                </Button>
              )}
            </header>
            {profile.about ? (
              <div
                className="social-panel__body rich-text-content"
                dangerouslySetInnerHTML={{ __html: profile.about }}
              />
            ) : (
              <p className="social-panel__body">{t('PROFILE_ABOUT_EMPTY')}</p>
            )}
          </article>
        </section>

        <aside className="social-page__right-column">
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
                to={ROUTES.profile + '/' + profile.url + '/friends'}
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
              <div className="social-preview-grid">
                {friends.map((friend) => (
                  <Link
                    className="social-preview-link"
                    key={friend.id}
                    to={ROUTES.profile + '/' + friend.url}
                    aria-label={friend.name}
                    title={friend.name}
                  >
                    <PreviewAvatar
                      name={friend.name}
                      picture={friend.picture}
                    />
                  </Link>
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
                to={ROUTES.profile + '/' + profile.url + '/communities'}
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
              <div className="social-preview-grid">
                {communities.map((community) => (
                  <Link
                    className="social-preview-link"
                    key={community.id}
                    to={ROUTES.community + '/' + community.url}
                    aria-label={community.name}
                    title={community.name}
                  >
                    <PreviewAvatar
                      name={community.name}
                      picture={community.picture}
                    />
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
