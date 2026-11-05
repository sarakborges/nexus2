import type { RelationshipType } from '@nexus/common'

export type RelationshipActionsProps = {
  targetId: string
  targetKind?: 'profile' | 'community'
}

export type RelationshipAction =
  | { type: 'remove' }
  | { type: RelationshipType }
