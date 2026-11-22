import type { Community, Profile, ProfilePageData, Relationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseProfilePageResult = {
  requestedUrl: string
  isAuthInitialized: boolean
  profilePageQuery: UseQueryResult<ProfilePageData>
  profile: Profile | null | undefined
  viewerRelationship: Relationship | null
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  canInteract: boolean
  friends: Profile[]
  communities: Community[]
  isOwner: boolean
  openEditProfile: () => void
}
