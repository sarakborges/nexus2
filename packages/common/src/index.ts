export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export type ListSort = 'activity-desc' | 'activity-asc' | 'name-asc' | 'name-desc'
export type PaginationParams = { page?: number; pageSize?: number; query?: string; sort?: ListSort; messageTab?: 'all' | 'favorites'; communityTab?: 'all' | 'managed' }
export type PaginatedResult<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number }
export type ProfileType = 'social' | 'rp' | 'business'
export type Profile = { id: string; name: string; url: string; picture: string; about: string; type: ProfileType; createdAt: number; lastActivity: number }
export type CreateProfileInput = Omit<Profile, 'id' | 'url' | 'createdAt' | 'lastActivity'> & { url?: string }
export type CreateProfileResult = { profile: Profile; user: AuthenticatedUser }
export type CommunityPrivacy = 'public' | 'private' | 'unlisted'
export type Community = { id: string; name: string; url: string; picture: string; about: string; type: ProfileType; privacy: CommunityPrivacy; createdAt: number; lastActivity: number }
export type CreateCommunityInput = Omit<Community, 'id' | 'type' | 'url' | 'createdAt' | 'lastActivity'> & { url?: string }
export type SearchScope = 'all' | 'profiles' | 'communities'
export type SearchResultItem =
  | { kind: 'profile'; profile: Profile }
  | { kind: 'community'; community: Community }
export type RelationshipType = 'connection' | 'requested' | 'blocked'
export type Relationship = { profiles: [string, string]; type: RelationshipType; requestedBy: string | null; blockedBy: string | null; updatedAt: number }
export type CommunityRelationshipType = 'owner' | 'moderator' | 'connection' | 'requested' | 'blocked'
export type CommunityRelationship = { profiles: [string, string]; type: CommunityRelationshipType; requestedBy: string | null; blockedBy: string | null; updatedAt: number }

export type CommunityForumTopic = { id: string; communityId: string; profileId: string; title: string; content: string; createdAt: number; updatedAt: number; isPinned: boolean; isLocked: boolean }
export type CommunityForumTopicSummary = CommunityForumTopic & { replyCount: number }
export type CommunityForumReply = { id: string; topicId: string; communityId: string; profileId: string; content: string; createdAt: number; updatedAt: number }
export type CommunityForumTopicDetail = { topic: CommunityForumTopicSummary; replies: PaginatedResult<CommunityForumReply> }
export type ProfileMessage = { id: string; fromProfileId: string; toProfileId: string; content: string; createdAt: number; isFavorite?: boolean }
export type ProfilePost = { id: string; profileId: string; content: string; createdAt: number }
export type AuthenticatedUser = { id: string; email: string; profiles: string[]; currentProfile: string | null }
export type AuthTokenPair = { accessToken: string; refreshToken: string; expiresIn: number; user: AuthenticatedUser }
export type AuthSession = { user: AuthenticatedUser; authenticatedAt: number }
export type SignInCredentials = { email: string; password: string }
export type SignUpCredentials = SignInCredentials
export type UserPreferences = { language: 'system' | 'pt-BR' | 'en-US'; theme: 'system' | 'light' | 'dark' }
export type ProfileSettings = { messageAudience: 'friends' | 'everyone'; publishActivityTypes: RecentActivity['type'][]; showFriendActivityTypes: RecentActivity['type'][] }
export type ApiErrorResponse = { statusCode: number; message: string | string[]; error?: string }

export type RecentActivity =
  | { id: string; type: 'friend_connected'; updatedAt: number; profile: Profile; friend: Profile }
  | { id: string; type: 'profile_post'; updatedAt: number; profile: Profile; content: string }
  | { id: string; type: 'community_created'; updatedAt: number; profile: Profile; community: Community }
  | {
      id: string
      type: 'community_membership'
      updatedAt: number
      profile: Profile
      community: Community
      role: Extract<CommunityRelationshipType, 'owner' | 'moderator' | 'connection'>
    }


export type HomePageData = {
  currentProfile: Profile | null
  activities: RecentActivity[]
  friends: PaginatedResult<Profile>
  communities: PaginatedResult<Community>
  suggestions: Community[]
}


export type ProfilePageData = {
  profile: Profile | null
  viewerRelationship: Relationship | null
  currentProfileType: ProfileType | null
  friends: PaginatedResult<Profile>
  communities: PaginatedResult<Community>
}


export type CommunityPageData = {
  community: Community | null
  relationships: CommunityRelationship[]
  viewerRelationship: CommunityRelationship | null
  currentProfileType: ProfileType | null
  canViewMembers: boolean
  canEditCommunity: boolean
  pendingRequestCount: number
  members: PaginatedResult<Profile>
  forumTopics: PaginatedResult<CommunityForumTopicSummary>
  forumAuthors: Profile[]
}


export type CommunityForumPageData = {
  community: Community | null
  viewerRelationship: CommunityRelationship | null
  currentProfileType: ProfileType | null
  canReadForum: boolean
  canPublish: boolean
  topics: PaginatedResult<CommunityForumTopicSummary>
  authors: Profile[]
}


export type CommunityForumTopicPageData = {
  community: Community
  detail: CommunityForumTopicDetail
  forumProfileId: string | null
  viewerRelationship: CommunityRelationship | null
  currentProfileType: ProfileType | null
  isMember: boolean
  isStaff: boolean
  authors: Profile[]
}


export type CommunityMember = Profile & {
  role: string
}

export type CommunityMembersPageData = {
  community: Community | null
  relationships: CommunityRelationship[]
  viewerRelationship: CommunityRelationship | null
  currentProfileType: ProfileType | null
  actorProfileId: string | null
  actorRole: CommunityRelationshipType | null
  isStaff: boolean
  visibleTab: 'all' | 'staff' | 'banned'
  members: PaginatedResult<CommunityMember>
  pending: PaginatedResult<CommunityMember>
}


export type ProfileMessagePermissions = { canDelete: boolean; canFavorite: boolean; canReply: boolean }
export type ProfileMessagesPageData = {
  profile: Profile | null
  viewerRelationship: Relationship | null
  currentProfileType: ProfileType | null
  isProfileOwner: boolean
  messageTab: 'all' | 'favorites'
  messages: PaginatedResult<ProfileMessage>
  senders: Profile[]
  messagePermissions: Record<string, ProfileMessagePermissions>
}


export type CommunitiesPageData = {
  currentProfile: Profile | null
  communityTab: 'all' | 'managed'
  communities: PaginatedResult<Community>
}


export type ProfileDirectoryPageData =
  | {
      kind: 'friends'
      profile: Profile | null
      viewerRelationship: Relationship | null
      currentProfileType: ProfileType | null
      friendRelationships: Relationship[]
      friends: PaginatedResult<Profile>
    }
  | {
      kind: 'communities'
      profile: Profile | null
      viewerRelationship: Relationship | null
      currentProfileType: ProfileType | null
      communities: PaginatedResult<Community>
    }


export type CommunityForumComposerPageData = {
  community: Community | null
  forumProfile: Profile | null
  viewerRelationship: CommunityRelationship | null
  currentProfileType: ProfileType | null
}

export type CommunityEditPageData = {
  community: Community | null
  ownerProfileId: string | null
  currentProfileType: ProfileType | null
}

export type ProfileEditPageData = {
  profile: Profile | null
  currentProfileType: ProfileType | null
}
