import { RequestState } from '@/Components'
import { ProfileSidebar } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button, RichTextContent } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfilePageEntityPreview } from './ProfilePageEntityPreview.component'
import { useProfilePage } from './useProfilePage'

import '../AuthenticatedPage.style.scss'
import './ProfilePage.style.scss'

export function ProfilePage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    isAuthInitialized,
    profilePageQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    canInteract,
    friends,
    communities,
    isOwner,
    openEditProfile
  } = useProfilePage()

  if (!requestedUrl) return <NotFoundPage />
  if (!isAuthInitialized || profilePageQuery.isLoading) {
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
            relationship={viewerRelationship}
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
              <RichTextContent className="social-panel__body" html={profile.about} />
            ) : (
              <p className="social-panel__body">{t('PROFILE_ABOUT_EMPTY')}</p>
            )}
          </article>
        </section>

        <aside className="social-page__right-column">
          <ProfilePageEntityPreview
            title={t('PROFILE_FRIENDS_TITLE')}
            totalItems={profilePageQuery.data?.friends.totalItems}
            allHref={`${ROUTES.profile}/${profile.url}/friends`}
            allLabel={t('COMMON_VIEW_ALL')}
            isLoading={profilePageQuery.isLoading}
            isFetching={profilePageQuery.isFetching}
            isError={profilePageQuery.isError}
            isSuccess={profilePageQuery.isSuccess}
            emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
            onRetry={() => void profilePageQuery.refetch()}
            entries={friends.map((friend) => ({
              id: friend.id,
              name: friend.name,
              picture: friend.picture,
              href: `${ROUTES.profile}/${friend.url}`
            }))}
          />
          <ProfilePageEntityPreview
            title={t('PROFILE_COMMUNITIES_TITLE')}
            totalItems={profilePageQuery.data?.communities.totalItems}
            allHref={`${ROUTES.profile}/${profile.url}/communities`}
            allLabel={t('COMMON_VIEW_ALL')}
            isLoading={profilePageQuery.isLoading}
            isFetching={profilePageQuery.isFetching}
            isError={profilePageQuery.isError}
            isSuccess={profilePageQuery.isSuccess}
            emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
            onRetry={() => void profilePageQuery.refetch()}
            entries={communities.map((community) => ({
              id: community.id,
              name: community.name,
              picture: community.picture,
              href: `${ROUTES.community}/${community.url}`
            }))}
          />
        </aside>
      </div>
    </main>
  )
}
