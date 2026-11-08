import type {
  AuthSession,
  Community,
  CommunityForumPageData,
  CommunityForumTopicSummary,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseCommunityForumPageResult = {
  normalized: string
  session: AuthSession | null
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  forumPageQuery: UseQueryResult<CommunityForumPageData>
  community: Community | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  canReadForum: boolean
  canPublish: boolean
  openCreateTopic: () => void
  topics: CommunityForumTopicSummary[]
  authorsById: Map<string, Profile>
}
