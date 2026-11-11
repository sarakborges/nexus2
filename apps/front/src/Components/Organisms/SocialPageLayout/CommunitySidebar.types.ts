import type { Community, CommunityRelationship } from '@nexus/common'

export type CommunitySidebarProps = {
  community: Community
  active: 'about' | 'members' | 'forum'
  canInteract?: boolean
  relationship?: CommunityRelationship | null
}
