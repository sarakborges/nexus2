import { Link } from 'react-router'

import { Pagination, RelationshipActions, RequestState } from '@/Components'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useProfileFriendsPage } from './useProfileFriendsPage'

import '../AuthenticatedPage.style.scss'

export function ProfileFriendsPage() {
  const { t } = useTranslations()
  const {
    normalized,
    isAuthInitialized,
    profileDirectoryQuery,
    profile,
    viewerRelationship,
    friendRelationshipsByProfileId,
    typeCompatibility,
    canInteract,
    page,
    pageSize,
    setPage,
    friends,
    totalItems
  } = useProfileFriendsPage()

  if (!normalized) return <NotFoundPage />
  if (!isAuthInitialized || profileDirectoryQuery.isLoading) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  }
  if (profileDirectoryQuery.isError) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void profileDirectoryQuery.refetch()}
          />
        </section>
      </main>
    )
  }
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={<ProfileSidebar profile={profile} active="friends" relationship={viewerRelationship} />}
    >
      <div className="social-page__content-stack">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('PROFILE_FRIENDS_TITLE')}</h1>
        </header>
        <RequestState isFetching={profileDirectoryQuery.isFetching} />
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>
        )}
        <RequestState
          isLoading={profileDirectoryQuery.isLoading}
          isFetching={profileDirectoryQuery.isFetching}
          isError={profileDirectoryQuery.isError}
          isEmpty={profileDirectoryQuery.isSuccess && totalItems === 0}
          emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
          onRetry={() => void profileDirectoryQuery.refetch()}
        >
          <div className="account-card__profile-list account-card__profile-list--grid">
            {friends.map((friend) => (
              <article
                className="account-card__profile-entry account-card__profile-entry--card"
                key={friend.id}
              >
                <Link
                  className="account-card__profile-entry-identity"
                  to={`${ROUTES.profile}/${friend.url}`}
                >
                  <span className="account-card__profile-entry-avatar">
                    {friend.picture ? (
                      <img src={friend.picture} alt="" />
                    ) : (
                      <span aria-hidden="true">
                        {friend.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="account-card__profile-entry-copy">
                    <span className="account-card__link">{friend.name}</span>
                    <span className="account-card__profile-entry-secondary">
                      @{friend.url}
                    </span>
                  </span>
                </Link>
                {canInteract && <RelationshipActions targetId={friend.id} relationship={friendRelationshipsByProfileId.get(friend.id) ?? null} />}
              </article>
            ))}
          </div>
        </RequestState>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>
    </SocialPageLayout>
  )
}
