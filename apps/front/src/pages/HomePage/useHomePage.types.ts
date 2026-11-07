import type {
  Community,
  PaginatedResult,
  Profile,
  RecentActivity
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseHomePageResult = {
  activityQuery: UseQueryResult<RecentActivity[]>
  profilesQuery: UseQueryResult<Profile[]>
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  communitiesQuery: UseQueryResult<PaginatedResult<Community>>
  allCommunitiesQuery: UseQueryResult<PaginatedResult<Community>>
  ownedCommunityIdsQuery: UseQueryResult<string[]>
  currentProfile: Profile | null
  activities: RecentActivity[]
  friends: Profile[]
  communities: Community[]
  suggestions: Community[]
  formatDate: (timestamp: number) => string
}
