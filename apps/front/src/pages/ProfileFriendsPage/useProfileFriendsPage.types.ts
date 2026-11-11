import type { Profile, ProfileDirectoryPageData, Relationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseProfileFriendsPageResult = {
  normalized: string
  isAuthInitialized: boolean
  profileDirectoryQuery: UseQueryResult<ProfileDirectoryPageData>
  profile: Profile | null | undefined
  viewerRelationship: Relationship | null
  friendRelationshipsByProfileId: Map<string, Relationship>
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  canInteract: boolean
  page: number
  pageSize: number
  query: string
  sort: ReturnType<typeof useUrlPagination>['sort']
  setQuery: ReturnType<typeof useUrlPagination>['setQuery']
  setSort: ReturnType<typeof useUrlPagination>['setSort']
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  friends: Profile[]
  totalItems: number
}
