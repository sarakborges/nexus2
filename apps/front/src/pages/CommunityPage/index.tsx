import { RequestState } from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityPageAboutPreview } from './CommunityPageAboutPreview.component'
import { CommunityPageForumPreview } from './CommunityPageForumPreview.component'
import { CommunityPageMembersPreview } from './CommunityPageMembersPreview.component'
import { useCommunityPage } from './useCommunityPage'

import './CommunityPage.style.scss'

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
      {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
        <p className="profile-type-notice" role="alert">
          {t('PROFILE_TYPE_MISMATCH_NOTICE')}
        </p>
      )}
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
