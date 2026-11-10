import type { CommunityRelationship, Relationship } from '@nexus/common'

export type RelationshipActionsProps = {
  targetId: string
  targetKind?: 'profile' | 'community'
  relationship?: Relationship | CommunityRelationship | null
}
