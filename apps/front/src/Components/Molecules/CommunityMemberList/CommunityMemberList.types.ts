import type { CommunityRelationship } from '@nexus/common'
import type { CommunityMember } from '@/Models/CommunityMember.model'

export type CommunityMemberListProps = {
  members: CommunityMember[]
  relationships: CommunityRelationship[]
  communityId: string
  actorProfileId: string | null
  actorRole: CommunityRelationship['type'] | null
  isStaff: boolean
}
