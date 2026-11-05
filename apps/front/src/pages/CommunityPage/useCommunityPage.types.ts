import type {
  AuthSession,
  Community,
  CommunityForumTopicSummary,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type {
  getCommunityMembers,
  getPendingCommunityMembers
} from '@/Services/CommunityRelationship'
import type { getCommunityForumTopics } from '@/Services/CommunityForum'

export type UseCommunityPageResult = {
  session: AuthSession | null
  requestedUrl: string
  communityQuery: UseQueryResult<Community | null>
  community: Community | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  canInteract: boolean
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  privateMembership: boolean
  canViewMembers: boolean
  pendingActor: CommunityRelationship | null
  pendingRequestsQuery: UseQueryResult<Awaited<ReturnType<typeof getPendingCommunityMembers>>>
  membersQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityMembers>>>
  forumTopicsQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityForumTopics>>>
  forumTopics: CommunityForumTopicSummary[]
  forumAuthorIds: string[]
  forumAuthorsQuery: UseQueryResult<Profile[]>
  forumAuthorsById: Map<string, Profile>
}
