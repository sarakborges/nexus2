import type {
  AuthSession,
  Community,
  CommunityForumTopicSummary,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { getCommunityForumTopics } from '@/Services/CommunityForum'

export type UseCommunityForumPageResult = {
  normalized: string
  session: AuthSession | null
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  communityQuery: UseQueryResult<Community | null>
  community: Community | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  ownedProfilesQuery: UseQueryResult<Profile[]>
  canPublish: boolean
  topicsQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityForumTopics>>>
  topics: CommunityForumTopicSummary[]
  authorsQuery: UseQueryResult<Profile[]>
  authorsById: Map<string, Profile>
}
