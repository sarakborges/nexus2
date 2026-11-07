import type { Community, PaginatedResult } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { UseProfileDirectoryContextResult } from '@/Hooks/Profile'

export type UseProfileCommunitiesPageResult =
  UseProfileDirectoryContextResult & {
    communitiesQuery: UseQueryResult<PaginatedResult<Community>>
    communities: Community[]
    totalItems: number
  }
