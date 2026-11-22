import { AuthenticatedPageState } from '@/Components/Templates/AuthenticatedPageState'
import { PaginatedListControls } from '@/Components/Molecules/PaginatedListControls'
import { CommunitySidebar } from '@/Components/Organisms/CommunitySidebar'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundState } from '@/Components/Organisms/NotFoundState'
import { CommunityMemberDirectory } from '@/Components/Organisms/CommunityMemberDirectory'
import { CommunityPendingMembersSection } from '@/Components/Organisms/CommunityPendingMembersSection'
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

  if (!normalized) return <NotFoundState />
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
  if (!community) return <NotFoundState />

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
      <div className="community-members-page">
        {(totalMembers > 0 && (
          <PaginatedListControls
            key={query}
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={setSort}
          />
        ))}
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
          />)}
        
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
