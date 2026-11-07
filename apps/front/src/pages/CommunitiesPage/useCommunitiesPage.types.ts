import type { Community, PaginatedResult, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseCommunitiesPageResult = {
  profilesQuery: UseQueryResult<Profile[]>
  currentProfile: Profile | null
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  communitiesQuery: UseQueryResult<PaginatedResult<Community>>
  communities: Community[]
  totalItems: number
}
