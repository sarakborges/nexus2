import { RequestState } from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityMemberDirectory } from './CommunityMemberDirectory.component'
import { CommunityPendingMembersSection } from './CommunityPendingMembersSection.component'
import { useCommunityMembersPage } from './useCommunityMembersPage'

import '../AuthenticatedPage.style.scss'
import './CommunityMembersPage.style.scss'

export function CommunityMembersPage() {
  const { t } = useTranslations()
  const {
    normalized,
    isAuthInitialized,
    activeTab,
    setActiveTab,
    page,
    pageSize,
    setPage,
    pendingPage,
    pendingPageSize,
    setPendingPage,
    communityMembersPageQuery,
    community,
    typeCompatibility,
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
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  }
  if (communityMembersPageQuery.isError) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void communityMembersPageQuery.refetch()}
          />
        </section>
      </main>
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
        />
      }
    >
      <RequestState isFetching={communityMembersPageQuery.isFetching} />
      <div className="community-members-page">
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
          />
        )}
        <CommunityMemberDirectory
          pageQuery={communityMembersPageQuery}
          typeCompatibility={typeCompatibility}
          tabs={tabs}
          activeTab={activeTab}
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
