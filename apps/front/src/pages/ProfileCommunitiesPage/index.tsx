import { Link } from 'react-router'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { Pagination, RequestState } from '@/Components'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
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

  if (!normalized) return <NotFoundPage />
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
        <PaginatedListControls key={query} query={query} sort={sort} onQueryChange={setQuery} onSortChange={setSort} />
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
