import type { Profile, ProfileDirectoryPageData, Relationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseProfileFriendsPageResult = {
  normalized: string
  profileDirectoryQuery: UseQueryResult<ProfileDirectoryPageData>
  profile: Profile | null | undefined
  viewerRelationship: Relationship | null
  friendRelationshipsByProfileId: Map<string, Relationship>
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  canInteract: boolean
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  friends: Profile[]
  totalItems: number
}
