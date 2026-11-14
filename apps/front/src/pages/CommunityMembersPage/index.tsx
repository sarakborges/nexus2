import { RequestState } from '@/Components'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityMemberDirectory } from './CommunityMemberDirectory.component'
import { CommunityPendingMembersSection } from './CommunityPendingMembersSection.component'
import { useCommunityMembersPage } from './useCommunityMembersPage'

import './CommunityMembersPage.style.scss'

export function CommunityMembersPage() {
  const { t } = useTranslations()
  const {
    normalized,
    isAuthInitialized,
    setActiveTab,
    query,
    sort,
    setQuery,
    setSort,
    page,
    pageSize,
    setPage,
    pendingPage,
    pendingPageSize,
    setPendingPage,
    communityMembersPageQuery,
    community,
    typeCompatibility,
    viewerRelationship,
    relationships,
    actorProfileId,
    currentRole,
    isStaff,
    visibleTab,
    members,
    totalMembers,
    pending,
    totalPending
  } = useCommunityMembersPage()

  const tabs = [
    { id: 'all' as const, label: t('COMMUNITY_TAB_ALL') },
    ...(isStaff
      ? [
          { id: 'staff' as const, label: t('COMMUNITY_TAB_STAFF') },
          { id: 'banned' as const, label: t('COMMUNITY_TAB_BANNED') }
        ]
      : [])
  ]

  if (!normalized) return <NotFoundPage />
  if (!isAuthInitialized || communityMembersPageQuery.isLoading) {
    return <AuthenticatedPageState isLoading />
  }
  if (communityMembersPageQuery.isError) {
    return (
      <AuthenticatedPageState
        isError
        onRetry={() => void communityMembersPageQuery.refetch()}
      />
    )
  }
  if (!community) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar
          community={community}
          active="members"
          canInteract={typeCompatibility.canInteract}
          relationship={viewerRelationship}
        />
      }
    >
      <RequestState isFetching={communityMembersPageQuery.isFetching} />
      <div className="community-members-page">
        {(totalMembers > 0 && (
          <PaginatedListControls
            key={query}
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={setSort}
          />
        )}
        {isStaff && (
          <CommunityPendingMembersSection
            pageQuery={communityMembersPageQuery}
            pending={pending}
            totalPending={totalPending}
            page={pendingPage}
            pageSize={pendingPageSize}
            onPageChange={setPendingPage}
            relationships={relationships}
            communityId={community.id}
            actorProfileId={actorProfileId}
            actorRole={currentRole}
            isStaff={isStaff}
          />))}
        
        <CommunityMemberDirectory
          pageQuery={communityMembersPageQuery}
          typeCompatibility={typeCompatibility}
          tabs={tabs}
          visibleTab={visibleTab}
          onSelectTab={setActiveTab}
          members={members}
          totalMembers={totalMembers}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          relationships={relationships}
          communityId={community.id}
          actorProfileId={actorProfileId}
          actorRole={currentRole}
          isStaff={isStaff}
        />
      </div>
    </SocialPageLayout>
  )
}
