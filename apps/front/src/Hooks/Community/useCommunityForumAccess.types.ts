import type { CommunityRelationship, Profile, ProfileType } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseCommunityForumAccessOptions = {
  communityId: string | null
  communityType: ProfileType | null
  viewerUserId: string | null
  profileIds: string[]
  currentProfileId: string | null
  relationshipsEnabled?: boolean
}

export type UseCommunityForumAccessResult = {
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  ownedProfilesQuery: UseQueryResult<Profile[]>
  forumProfile: Profile | null
  forumProfileId: string | null
  isMember: boolean
  isStaff: boolean
  canPublish: boolean
}
