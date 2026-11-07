import type { CommunityRelationship } from '@nexus/common'

import type { Member } from './CommunityMembersPage.types'

export type CommunityMemberEntryProps = {
  profile: Member
  relationships: CommunityRelationship[]
  communityId: string
  actorProfileId: string | null
  actorRole: CommunityRelationship['type'] | null
  isStaff: boolean
}
