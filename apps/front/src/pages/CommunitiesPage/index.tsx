import { Link } from 'react-router'

import { Pagination, RequestState } from '@/Components'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCommunitiesPage } from './useCommunitiesPage'

import '../AuthenticatedPage.style.scss'

export function CommunitiesPage() {
  const { t } = useTranslations()
  const {
    isAuthInitialized,
    communitiesPageQuery,
    currentProfile,
    page,
    pageSize,
    setPage,
    query,
    sort,
    setQuery,
    setSort,
    communities,
    totalItems
  } = useCommunitiesPage()

  if (!currentProfile)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isLoading={!isAuthInitialized || communitiesPageQuery.isLoading}
            isError={communitiesPageQuery.isError}
            onRetry={() => void communitiesPageQuery.refetch()}
          />
        </section>
      </main>
    )

  return (
    <SocialPageLayout
      sidebar={
        <ProfileSidebar
          profile={currentProfile}
          active="community-list"
          showRelationshipActions={false}
        />
      }
    >
      <div className="social-page__content-stack">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('COMMUNITIES_TITLE')}</h1>
          <ButtonLink
            className="account-card__action"
            variation="primary"
            to={ROUTES.createCommunity}
          >
            {t('COMMUNITIES_CREATE')}
          </ButtonLink>
        </header>
        <PaginatedListControls key={query} query={query} sort={sort} onQueryChange={setQuery} onSortChange={setSort} />
        <RequestState
          isLoading={communitiesPageQuery.isLoading}
          isFetching={communitiesPageQuery.isFetching}
          isError={communitiesPageQuery.isError}
          isEmpty={communitiesPageQuery.isSuccess && totalItems === 0}
          emptyMessage={t('COMMUNITIES_EMPTY')}
          onRetry={() => void communitiesPageQuery.refetch()}
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
