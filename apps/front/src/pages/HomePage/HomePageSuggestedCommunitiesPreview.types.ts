import type { Community, PaginatedResult } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageSuggestedCommunitiesPreviewProps = {
  allCommunitiesQuery: UseQueryResult<PaginatedResult<Community>>
  ownedCommunityIdsQuery: UseQueryResult<string[]>
  suggestions: Community[]
}
