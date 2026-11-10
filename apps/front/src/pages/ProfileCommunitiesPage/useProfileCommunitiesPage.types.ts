import type { Community, Profile, ProfileDirectoryPageData, Relationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseProfileCommunitiesPageResult = {
  normalized: string
  profileDirectoryQuery: UseQueryResult<ProfileDirectoryPageData>
  profile: Profile | null | undefined
  viewerRelationship: Relationship | null
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  communities: Community[]
  totalItems: number
}
