import type {
  Community,
  PaginatedResult,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageRightSidebarProps = {
  currentProfile: Profile
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  communitiesQuery: UseQueryResult<PaginatedResult<Community>>
  allCommunitiesQuery: UseQueryResult<PaginatedResult<Community>>
  ownedCommunityIdsQuery: UseQueryResult<string[]>
  friends: Profile[]
  communities: Community[]
  suggestions: Community[]
}
