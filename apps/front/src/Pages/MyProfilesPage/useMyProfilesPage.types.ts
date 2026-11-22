import type { Profile, PaginatedResult } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseMyProfilesPageResult = {
  isAuthInitialized: boolean
  currentProfileId: string | null
  profilesQuery: UseQueryResult<PaginatedResult<Profile>, Error>
  profiles: Profile[]
  page: number
  pageSize: number
  setPage: (page: number) => void
  isSelectingProfile: boolean
  isDeletingProfile: boolean
  profileToDelete: Profile | null
  selectProfile: (profileId: string) => void
  requestDeleteProfile: (profile: Profile) => void
  cancelDeleteProfile: () => void
  confirmDeleteProfile: () => void
}
