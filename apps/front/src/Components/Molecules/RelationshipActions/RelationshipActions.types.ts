import type { CommunityRelationship, Relationship } from '@nexus/common'

export type RelationshipActionsProps = {
  targetId: string
  targetKind?: 'profile' | 'community'
  relationship?: Relationship | CommunityRelationship | null
  className?: string
  buttonClassName?: string
}
 
import type { TranslationKey } from '@/Types/Translation.type'

export type RelationshipAction = {
  label: TranslationKey
  variation: 'primary' | 'secondary' | 'cancel'
  run: () => void
}
