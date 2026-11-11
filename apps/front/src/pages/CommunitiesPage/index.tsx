import { Pagination, RequestState } from '@/Components'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
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
          <EntityDirectoryGrid
            entries={communities.map((community) => ({
              id: community.id,
              name: community.name,
              picture: community.picture,
              href: `${ROUTES.community}/${community.url}`,
              secondaryText: `/community/${community.url}`
            }))}
          />
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
