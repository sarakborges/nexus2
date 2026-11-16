import { Pagination } from '@/Components/Molecules/Pagination'
import { RequestState } from '@/Components/Molecules/RequestState'
import { AuthenticatedPageState } from '@/Components/Templates/AuthenticatedPageState'
import { Link } from 'react-router'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { PaginatedListControls } from '@/Components/Molecules/PaginatedListControls'
import { ProfileSidebar } from '@/Components/Organisms/ProfileSidebar'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink, Tabs } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCommunitiesPage } from './useCommunitiesPage'

import './CommunitiesPage.style.scss'

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
      <AuthenticatedPageState
        isLoading={!isAuthInitialized || communitiesPageQuery.isLoading}
        isError={communitiesPageQuery.isError}
        onRetry={() => void communitiesPageQuery.refetch()}
      />
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
        <header className="communities-page__header">
          <h1 className="communities-page__title">{t('COMMUNITIES_TITLE')}</h1>
          <ButtonLink
            className="communities-page__create-action"
            variation="primary"
            to={ROUTES.createCommunity}
          >
            {t('COMMUNITIES_CREATE')}
          </ButtonLink>
        </header>
        <Tabs
          ariaLabel={t('COMMUNITIES_TABS_LABEL')}
          value={communityTab}
          onChange={handleCommunityTabChange}
          options={[
            { value: 'all', label: t('COMMUNITIES_TAB_ALL') },
            { value: 'managed', label: t('COMMUNITIES_TAB_MANAGED') }
          ]}
        />
        {totalItems > 0 && (
          <PaginatedListControls
            key={query}
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={setSort}
          />
        )}

        <RequestState
          isLoading={communitiesPageQuery.isLoading}
          isFetching={communitiesPageQuery.isFetching}
          isError={communitiesPageQuery.isError}
          isEmpty={communitiesPageQuery.isSuccess && totalItems === 0}
          emptyMessage={t('COMMUNITIES_EMPTY')}
          emptyAction={
            <Link to={`${ROUTES.search}?scope=communities`}>
              {t('COMMUNITIES_EMPTY_SEARCH')}
            </Link>
          }
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
        {totalItems > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        )}
      </div>
    </SocialPageLayout>
  )
}
