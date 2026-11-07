import type { CommunityForumTopicSummary, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { getCommunityForumTopics } from '@/Services/CommunityForum'

export type CommunityPageForumPreviewProps = {
  communityUrl: string
  topicsQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityForumTopics>>>
  authorsQuery: UseQueryResult<Profile[]>
  topics: CommunityForumTopicSummary[]
  authorsById: Map<string, Profile>
}
