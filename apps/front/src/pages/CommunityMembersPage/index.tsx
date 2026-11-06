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
    activeTab,
    setActiveTab,
    page,
    pageSize,
    setPage,
    pendingPage,
    pendingPageSize,
    setPendingPage,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    relationships,
    actorProfileId,
    currentRole,
    isStaff,
    visibleTab,
    membersQuery,
    pendingQuery,
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
  if (communityQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (communityQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isError onRetry={() => void communityQuery.refetch()} />
        </section>
      </main>
    )
  if (!community) return <NotFoundPage />
  if (relationshipsQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (relationshipsQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void relationshipsQuery.refetch()}
          />
        </section>
      </main>
    )

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar
          community={community}
          active="members"
          canInteract={
            typeCompatibility.isCompatible && !typeCompatibility.isChecking
          }
        />
      }
    >
      <div className="community-members-page">
        {isStaff && (
          <CommunityPendingMembersSection
            pendingQuery={pendingQuery}
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
          typeCompatibility={typeCompatibility}
          tabs={tabs}
          activeTab={activeTab}
          visibleTab={visibleTab}
          onSelectTab={setActiveTab}
          membersQuery={membersQuery}
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
