import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { Link } from 'react-router'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { EntityDirectoryGrid } from '@/Components/Organisms/EntityDirectoryGrid'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
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
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>)}
        
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
