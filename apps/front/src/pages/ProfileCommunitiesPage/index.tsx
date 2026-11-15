import { ProfileTypeNotice } from '@/Components/Atoms/ProfileTypeNotice'
import { Link } from 'react-router'
import { Pagination } from '@/Components/Molecules/Pagination'
import { RequestState } from '@/Components/Molecules/RequestState'
import { AuthenticatedPageState } from '@/Components/Templates/AuthenticatedPageState'
import { PaginatedListControls } from '@/Components/Molecules/PaginatedListControls'
import { ProfileSidebar } from '@/Components/Organisms/ProfileSidebar'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundState } from '@/Components/Organisms/NotFoundState'
import { useProfileCommunitiesPage } from './useProfileCommunitiesPage'


export function ProfileCommunitiesPage() {
  const { t } = useTranslations()
  const {
    normalized,
    isAuthInitialized,
    profileDirectoryQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    page,
    pageSize,
    setPage,
    query,
    sort,
    setQuery,
    setSort,
    communities,
    totalItems
  } = useProfileCommunitiesPage()

  if (!normalized) return <NotFoundState />
  if (!isAuthInitialized || profileDirectoryQuery.isLoading) {
    return <AuthenticatedPageState isLoading />
  }
  if (profileDirectoryQuery.isError) {
    return (
      <AuthenticatedPageState
        isError
        onRetry={() => void profileDirectoryQuery.refetch()}
      />
    )
  }
  if (!profile) return <NotFoundState />

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
        {(totalItems > 0 && (
          <PaginatedListControls
            key={query}
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={setSort}
          />))}
        
        <RequestState isFetching={profileDirectoryQuery.isFetching} />
        <ProfileTypeNotice
        isVisible={!typeCompatibility.isChecking && !typeCompatibility.isCompatible}
        message={t('PROFILE_TYPE_MISMATCH_NOTICE')}
      />
        
        <RequestState
          isLoading={profileDirectoryQuery.isLoading}
          isFetching={profileDirectoryQuery.isFetching}
          isError={profileDirectoryQuery.isError}
          isEmpty={profileDirectoryQuery.isSuccess && totalItems === 0}
          emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
          emptyAction={
            <Link to={`${ROUTES.search}?scope=communities`}>
              {t('PROFILE_COMMUNITIES_DISCOVER')}
            </Link>
          }
          onRetry={() => void profileDirectoryQuery.refetch()}
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
