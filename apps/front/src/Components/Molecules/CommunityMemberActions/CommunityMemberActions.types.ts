import type { CommunityRelationship } from '@nexus/common'

export type CommunityMemberActionsProps = {
  memberProfileId: string
  communityId: string
  actorProfileId: string
  actorRole: 'owner' | 'moderator'
  relationship: CommunityRelationship | null
}
