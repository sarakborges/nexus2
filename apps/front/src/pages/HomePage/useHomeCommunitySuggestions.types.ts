import type {
  Community,
  PaginatedResult,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseHomeCommunitySuggestionsOptions = {
  currentProfile: Profile | null
  profileIds: string[]
}

export type UseHomeCommunitySuggestionsResult = {
  allCommunitiesQuery: UseQueryResult<PaginatedResult<Community>>
  ownedCommunityIdsQuery: UseQueryResult<string[]>
  suggestions: Community[]
}
