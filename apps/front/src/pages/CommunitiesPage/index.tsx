import { Pagination, RequestState } from '@/Components'
import { Link } from 'react-router'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink, Tabs } from '@/DesignSystem'
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
    communityTab,
    handleCommunityTabChange,
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
        <Tabs ariaLabel={t('COMMUNITIES_TABS_LABEL')} value={communityTab} onChange={handleCommunityTabChange} options={[
          { value: 'all', label: t('COMMUNITIES_TAB_ALL') },
          { value: 'managed', label: t('COMMUNITIES_TAB_MANAGED') }
        ]} />
        <PaginatedListControls key={query} query={query} sort={sort} onQueryChange={setQuery} onSortChange={setSort} />
        <RequestState
          isLoading={communitiesPageQuery.isLoading}
          isFetching={communitiesPageQuery.isFetching}
          isError={communitiesPageQuery.isError}
          onRetry={() => void communitiesPageQuery.refetch()}
        >
          {totalItems === 0 ? (
            <div className="directory-empty-state">
              <p>{t('COMMUNITIES_EMPTY')}</p>
              <Link to={`${ROUTES.search}?scope=communities`}>{t('SEARCH_TITLE')}</Link>
            </div>
          ) : <EntityDirectoryGrid
            entries={communities.map((community) => ({
              id: community.id,
              name: community.name,
              picture: community.picture,
              href: `${ROUTES.community}/${community.url}`,
              secondaryText: `/community/${community.url}`
            }))}
          />}
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
