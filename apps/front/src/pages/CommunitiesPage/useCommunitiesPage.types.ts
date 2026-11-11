import type { CommunitiesPageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseCommunitiesPageResult = {
  isAuthInitialized: boolean
  communitiesPageQuery: UseQueryResult<CommunitiesPageData>
  currentProfile: CommunitiesPageData['currentProfile']
  page: number
  pageSize: number
  query: string
  sort: ReturnType<typeof useUrlPagination>['sort']
  setQuery: ReturnType<typeof useUrlPagination>['setQuery']
  setSort: ReturnType<typeof useUrlPagination>['setSort']
  communityTab: 'all' | 'managed'
  handleCommunityTabChange: (tab: string) => void
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  communities: CommunitiesPageData['communities']['items']
  totalItems: number
}
