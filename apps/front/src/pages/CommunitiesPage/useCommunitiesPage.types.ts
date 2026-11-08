import type { CommunitiesPageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseCommunitiesPageResult = {
  isAuthInitialized: boolean
  communitiesPageQuery: UseQueryResult<CommunitiesPageData>
  currentProfile: CommunitiesPageData['currentProfile']
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  communities: CommunitiesPageData['communities']['items']
  totalItems: number
}
