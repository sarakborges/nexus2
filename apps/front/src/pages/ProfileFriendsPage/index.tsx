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
    profileQuery,
    profile,
    typeCompatibility,
    canInteract,
    page,
    pageSize,
    setPage,
    friendsQuery,
    friends,
    totalItems
  } = useProfileFriendsPage()

  if (!normalized) return <NotFoundPage />
  if (profileQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (profileQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isError onRetry={() => void profileQuery.refetch()} />
        </section>
      </main>
    )
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={<ProfileSidebar profile={profile} active="friends" />}
    >
      <div className="social-page__content-stack">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('PROFILE_FRIENDS_TITLE')}</h1>
        </header>
        <RequestState isFetching={profileQuery.isFetching} />
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>
        )}
        <RequestState
          isLoading={friendsQuery.isLoading}
          isFetching={friendsQuery.isFetching}
          isError={friendsQuery.isError}
          isEmpty={friendsQuery.isSuccess && totalItems === 0}
          emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
          onRetry={() => void friendsQuery.refetch()}
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
                {canInteract && <RelationshipActions targetId={friend.id} />}
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
