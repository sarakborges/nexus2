import type { PaginatedResult, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseProfileFriendsPageResult = {
  normalized: string
  profileQuery: UseQueryResult<Profile | null>
  profile: Profile | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  canInteract: boolean
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  friends: Profile[]
  totalItems: number
}
