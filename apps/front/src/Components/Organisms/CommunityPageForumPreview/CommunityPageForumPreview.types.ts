import type { CommunityForumTopicSummary, CommunityPageData, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type CommunityPageForumPreviewProps = {
  communityUrl: string
  communityPageQuery: UseQueryResult<CommunityPageData>
  canViewMembers: boolean
  topics: CommunityForumTopicSummary[]
  authorsById: Map<string, Profile>
}
