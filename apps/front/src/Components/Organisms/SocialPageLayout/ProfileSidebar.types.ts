import type { Profile, Relationship } from '@nexus/common'

export type ProfileSidebarProps = {
  profile: Profile
  active:
    | 'home'
    | 'profile'
    | 'friends'
    | 'communities'
    | 'messages'
    | 'community-list'
  showRelationshipActions?: boolean
  portraitPicture?: boolean
  relationship?: Relationship | null
}
