import type { Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'

export type UseProfileDirectoryContextResult = {
  normalized: string
  profileQuery: UseQueryResult<Profile | null>
  profile: Profile | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
}
