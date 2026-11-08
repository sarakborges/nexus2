import type {
  Community,
  PaginatedResult,
  Profile
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseHomeSocialPreviewsOptions = {
  currentProfile: Profile | null
}

export type UseHomeSocialPreviewsResult = {
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  communitiesQuery: UseQueryResult<PaginatedResult<Community>>
  friends: Profile[]
  communities: Community[]
}
