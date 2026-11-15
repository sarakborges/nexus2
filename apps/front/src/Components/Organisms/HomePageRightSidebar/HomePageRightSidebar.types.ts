import type { Community, Profile } from '@nexus/common'

export type HomePagePreviewItem = Pick<Profile, 'id' | 'name' | 'url' | 'picture'>

export type HomePageRightSidebarProps = {
  currentProfile: Profile
  suggestedCommunities: Community[]
}
