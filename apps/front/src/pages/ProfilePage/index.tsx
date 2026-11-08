import { Link } from 'react-router'

import { IdentityAvatar, RequestState } from '@/Components'
import { ProfileSidebar } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useProfilePage } from './useProfilePage'

import '../AuthenticatedPage.style.scss'
import './ProfilePage.style.scss'

export function ProfilePage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    profilePageQuery,
    profile,
    typeCompatibility,
    canInteract,
    friends,
    communities,
    isOwner,
    openEditProfile
  } = useProfilePage()

  if (!requestedUrl) return <NotFoundPage />
  if (profilePageQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (profilePageQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState
            isError
            onRetry={() => void profilePageQuery.refetch()}
          />
        </div>
      </main>
    )
  }
  if (!profile) return <NotFoundPage />

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
          <RequestState isFetching={profilePageQuery.isFetching} />
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
                  onClick={openEditProfile}
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
                  ({profilePageQuery.data?.friends.totalItems ?? '—'})
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
              isLoading={profilePageQuery.isLoading}
              isFetching={profilePageQuery.isFetching}
              isError={profilePageQuery.isError}
              isEmpty={profilePageQuery.isSuccess && friends.length === 0}
              emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
              onRetry={() => void profilePageQuery.refetch()}
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
                    <IdentityAvatar
                      className="social-preview-avatar"
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
                  ({profilePageQuery.data?.communities.totalItems ?? '—'})
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
              isLoading={profilePageQuery.isLoading}
              isFetching={profilePageQuery.isFetching}
              isError={profilePageQuery.isError}
              isEmpty={profilePageQuery.isSuccess && communities.length === 0}
              emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
              onRetry={() => void profilePageQuery.refetch()}
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
                    <IdentityAvatar
                      className="social-preview-avatar"
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
