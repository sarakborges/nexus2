import type {
  AuthSession,
  Community,
  CommunityForumPageData,
  CommunityForumTopicSummary,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseCommunityForumPageResult = {
  normalized: string
  isAuthInitialized: boolean
  session: AuthSession | null
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  forumPageQuery: UseQueryResult<CommunityForumPageData>
  community: Community | null | undefined
  viewerRelationship: CommunityRelationship | null
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  canReadForum: boolean
  canPublish: boolean
  openCreateTopic: () => void
  topics: CommunityForumTopicSummary[]
  authorsById: Map<string, Profile>
}
