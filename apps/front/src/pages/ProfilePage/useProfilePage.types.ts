import type { Community, Profile, ProfilePageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'

export type UseProfilePageResult = {
  requestedUrl: string
  profilePageQuery: UseQueryResult<ProfilePageData>
  profile: Profile | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  canInteract: boolean
  friends: Profile[]
  communities: Community[]
  isOwner: boolean
  openEditProfile: () => void
}
