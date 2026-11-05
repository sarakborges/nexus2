import type { Community } from '@nexus/common'

export type CommunitySidebarProps = {
  community: Community
  active: 'about' | 'members' | 'forum'
  canInteract?: boolean
}
