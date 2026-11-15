import { ProfileTypeNotice } from '@/Components/Atoms/ProfileTypeNotice'
import { RequestState } from '@/Components'
import { CommunitySidebar } from '@/Components/Organisms/CommunitySidebar'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityPageAboutPreview } from '@/Components/Organisms/CommunityPageAboutPreview'
import { CommunityPageForumPreview } from '@/Components/Organisms/CommunityPageForumPreview'
import { CommunityPageMembersPreview } from '@/Components/Organisms/CommunityPageMembersPreview'
import { useCommunityPage } from './useCommunityPage'


export function CommunityPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    isAuthInitialized,
    communityPageQuery,
    community,
    viewerRelationship,
    typeCompatibility,
    canInteract,
    canViewMembers,
    canEditCommunity,
    openEditCommunity,
    pendingRequestCount,
    members,
    memberCount,
    forumTopics,
    forumAuthorsById
  } = useCommunityPage()

  if (!requestedUrl) return <NotFoundPage />

  if (!isAuthInitialized || communityPageQuery.isLoading) {
    return (
      <SocialPageLayout>
        <RequestState isLoading />
      </SocialPageLayout>
    )
  }

  if (communityPageQuery.isError) {
    return (
      <SocialPageLayout>
        <RequestState
          isError
          onRetry={() => void communityPageQuery.refetch()}
        />
      </SocialPageLayout>
    )
  }

  if (!community) return <NotFoundPage />

  return (
    <SocialPageLayout
      className="social-page--community"
      sidebar={
        <CommunitySidebar
          community={community}
          active="about"
          canInteract={canInteract}
          relationship={viewerRelationship}
        />
      }
      rightSidebar={
        <CommunityPageMembersPreview
          communityUrl={community.url}
          communityPageQuery={communityPageQuery}
          canViewMembers={canViewMembers}
          members={members}
          memberCount={memberCount}
        />
      }
    >
      <RequestState isFetching={communityPageQuery.isFetching} />
      <ProfileTypeNotice isChecking={typeCompatibility.isChecking} isCompatible={typeCompatibility.isCompatible} />
      <CommunityPageAboutPreview
        community={community}
        canViewMembers={canViewMembers}
        canEditCommunity={canEditCommunity}
        pendingRequestCount={pendingRequestCount}
        onEdit={openEditCommunity}
      />
      <CommunityPageForumPreview
        communityUrl={community.url}
        communityPageQuery={communityPageQuery}
        canViewMembers={canViewMembers}
        topics={forumTopics}
        authorsById={forumAuthorsById}
      />
    </SocialPageLayout>
  )
}
