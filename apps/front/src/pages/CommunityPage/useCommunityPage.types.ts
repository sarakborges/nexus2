import type { Community, CommunityPageData, CommunityForumTopicSummary, CommunityRelationship, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'

export type UseCommunityPageResult = {
  requestedUrl: string
  communityPageQuery: UseQueryResult<CommunityPageData>
  community: Community | null | undefined
  viewerRelationship: CommunityRelationship | null
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  canInteract: boolean
  canViewMembers: boolean
  canEditCommunity: boolean
  openEditCommunity: () => void
  pendingRequestCount: number
  members: Profile[]
  memberCount: number | undefined
  forumTopics: CommunityForumTopicSummary[]
  forumAuthorsById: Map<string, Profile>
}
