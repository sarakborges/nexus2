import { ProfileTypeNotice } from '@/Components/Atoms/ProfileTypeNotice'
import { Pagination } from '@/Components/Molecules/Pagination'
import { RelationshipActions } from '@/Components/Molecules/RelationshipActions'
import { RequestState } from '@/Components/Molecules/RequestState'
import { AuthenticatedPageState } from '@/Components/Templates/AuthenticatedPageState'
import { Link } from 'react-router'
import { PaginatedListControls } from '@/Components/Molecules/PaginatedListControls'
import { ProfileSidebar } from '@/Components/Organisms/ProfileSidebar'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundState } from '@/Components/Organisms/NotFoundState'
import { useProfileFriendsPage } from './useProfileFriendsPage'


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
    query,
    sort,
    setQuery,
    setSort,
    friends,
    totalItems
  } = useProfileFriendsPage()

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
      sidebar={<ProfileSidebar profile={profile} active="friends" relationship={viewerRelationship} />}
    >
      <div className="social-page__content-stack">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('PROFILE_FRIENDS_TITLE')}</h1>
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
          onRetry={() => void profileDirectoryQuery.refetch()}
        >
          {totalItems === 0 ? (
            <div className="directory-empty-state">
              <p>{t('RELATIONSHIP_FRIENDS_EMPTY')}</p>
              <Link to={`${ROUTES.search}?scope=profiles`}>{t('RELATIONSHIP_FRIENDS_EMPTY_SEARCH')}</Link>
            </div>
          ) : <EntityDirectoryGrid
            entries={friends.map((friend) => ({
              id: friend.id,
              name: friend.name,
              picture: friend.picture,
              href: `${ROUTES.profile}/${friend.url}`,
              secondaryText: `@${friend.url}`,
              actions: canInteract ? (
                <RelationshipActions
                  targetId={friend.id}
                  relationship={friendRelationshipsByProfileId.get(friend.id) ?? null}
                />
              ) : undefined
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
