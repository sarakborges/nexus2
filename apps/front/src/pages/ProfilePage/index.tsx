import { ProfilePageEntityPreview } from './ProfilePageEntityPreview.component'
import { RequestState } from '@/Components'
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
    profileQuery,
    profile,
    typeCompatibility,
    canInteract,
    friendsQuery,
    communitiesQuery,
    friends,
    communities,
    isOwner,
    openEditProfile
  } = useProfilePage()

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
          <ProfilePageEntityPreview
            title={t('PROFILE_FRIENDS_TITLE')}
            totalItems={friendsQuery.data?.totalItems}
            allHref={`${ROUTES.profile}/${profile.url}/friends`}
            allLabel={t('PROFILE_FRIENDS_LINK')}
            isLoading={friendsQuery.isLoading}
            isFetching={friendsQuery.isFetching}
            isError={friendsQuery.isError}
            isSuccess={friendsQuery.isSuccess}
            emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
            onRetry={() => void friendsQuery.refetch()}
            entries={friends.map((friend) => ({
              id: friend.id,
              name: friend.name,
              picture: friend.picture,
              href: `${ROUTES.profile}/${friend.url}`
            }))}
          />
          <ProfilePageEntityPreview
            title={t('PROFILE_COMMUNITIES_TITLE')}
            totalItems={communitiesQuery.data?.totalItems}
            allHref={`${ROUTES.profile}/${profile.url}/communities`}
            allLabel={t('PROFILE_COMMUNITIES_LINK')}
            isLoading={communitiesQuery.isLoading}
            isFetching={communitiesQuery.isFetching}
            isError={communitiesQuery.isError}
            isSuccess={communitiesQuery.isSuccess}
            emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
            onRetry={() => void communitiesQuery.refetch()}
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
