import type { Profile, Relationship } from '@nexus/common'

import type { UseProfileDirectoryPageResult } from '@/Hooks/Profile'

export type UseProfileFriendsPageResult = UseProfileDirectoryPageResult & {
  friendRelationshipsByProfileId: Map<string, Relationship>
  canInteract: boolean
  friends: Profile[]
  totalItems: number
}
