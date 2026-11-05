import type { AuthSession, Community, PaginatedResult, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'

export type UseProfilePageResult = {
  requestedUrl: string
  session: AuthSession | null
  profileQuery: UseQueryResult<Profile | null>
  profile: Profile | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  canInteract: boolean
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  communitiesQuery: UseQueryResult<PaginatedResult<Community>>
  friends: Profile[]
  communities: Community[]
  isOwner: boolean
  openEditProfile: () => void
}
