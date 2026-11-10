import { Link } from 'react-router'

import { Pagination, RequestState } from '@/Components'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useProfileCommunitiesPage } from './useProfileCommunitiesPage'

import '../AuthenticatedPage.style.scss'

export function ProfileCommunitiesPage() {
  const { t } = useTranslations()
  const {
    normalized,
    profileDirectoryQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    page,
    pageSize,
    setPage,
    communities,
    totalItems
  } = useProfileCommunitiesPage()

  if (!normalized) return <NotFoundPage />
  if (profileDirectoryQuery.isLoading) {
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
      sidebar={<ProfileSidebar profile={profile} active="communities" relationship={viewerRelationship} />}
    >
      <div className="social-page__content-stack">
        <header className="account-card__header">
          <h1 className="account-card__title">
            {t('PROFILE_COMMUNITIES_TITLE')}
          </h1>
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
          emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
          onRetry={() => void profileDirectoryQuery.refetch()}
        >
          <div className="account-card__profile-list account-card__profile-list--grid">
            {communities.map((community) => (
              <article
                className="account-card__profile-entry account-card__profile-entry--card"
                key={community.id}
              >
                <Link
                  className="account-card__profile-entry-identity"
                  to={`${ROUTES.community}/${community.url}`}
                >
                  <span className="account-card__profile-entry-avatar">
                    {community.picture ? (
                      <img src={community.picture} alt="" />
                    ) : (
                      <span aria-hidden="true">
                        {community.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="account-card__profile-entry-copy">
                    <span className="account-card__link">{community.name}</span>
                    <span className="account-card__profile-entry-secondary">
                      /community/{community.url}
                    </span>
                  </span>
                </Link>
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
