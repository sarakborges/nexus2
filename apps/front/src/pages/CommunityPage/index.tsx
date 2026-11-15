import { ProfileTypeNotice } from '@/Components/Atoms/ProfileTypeNotice'
import { EntityAvatarPreview } from '@/Components/Organisms/EntityAvatarPreview'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { RequestState } from '@/Components/Molecules/RequestState'
import { CommunitySidebar } from '@/Components/Organisms/CommunitySidebar'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { NotFoundState } from '@/Components/Organisms/NotFoundState'
import { CommunityPageAboutPreview } from '@/Components/Organisms/CommunityPageAboutPreview'
import { CommunityPageForumPreview } from '@/Components/Organisms/CommunityPageForumPreview'
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

  if (!requestedUrl) return <NotFoundState />

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

  if (!community) return <NotFoundState />

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
        <EntityAvatarPreview
          title={t('COMMUNITY_MEMBERS_TITLE')}
          totalItems={memberCount}
          allHref={`${ROUTES.community}/${community.url}/members`}
          allLabel={t('COMMON_VIEW_ALL')}
          isLoading={communityPageQuery.isLoading}
          isFetching={communityPageQuery.isFetching}
          isError={communityPageQuery.isError}
          isEmpty={!canViewMembers || (communityPageQuery.isSuccess && members.length === 0)}
          emptyMessage={
            canViewMembers
              ? t('COMMUNITY_MEMBERS_EMPTY')
              : t('COMMUNITY_PRIVATE_RESTRICTED')
          }
          onRetry={() => void communityPageQuery.refetch()}
          entries={members.map(member => ({
            id: member.id,
            href: `${ROUTES.profile}/${member.url}`,
            name: member.name,
            picture: member.picture
          }))}
        />
      }
    >
      <RequestState isFetching={communityPageQuery.isFetching} />
      <ProfileTypeNotice
        isVisible={!typeCompatibility.isChecking && !typeCompatibility.isCompatible}
        message={t('PROFILE_TYPE_MISMATCH_NOTICE')}
      />
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
