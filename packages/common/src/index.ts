export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export type PaginationParams = { page?: number; pageSize?: number }
export type PaginatedResult<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number }
export type ProfileType = 'social' | 'rp' | 'business'
export type Profile = { id: string; name: string; url: string; picture: string; about: string; type: ProfileType }
export type CreateProfileInput = Omit<Profile, 'id'>
export type CommunityPrivacy = 'public' | 'private' | 'unlisted'
export type Community = { id: string; name: string; url: string; picture: string; about: string; type: ProfileType; privacy: CommunityPrivacy }
export type CreateCommunityInput = Omit<Community, 'id' | 'type'>
export type RelationshipType = 'connection' | 'requested' | 'blocked'
export type Relationship = { profiles: [string, string]; type: RelationshipType; requestedBy: string | null; blockedBy: string | null; updatedAt: number }
export type CommunityRelationshipType = 'owner' | 'moderator' | 'connection' | 'requested' | 'blocked'
export type CommunityRelationship = { profiles: [string, string]; type: CommunityRelationshipType; requestedBy: string | null; blockedBy: string | null; updatedAt: number }

export type CommunityForumTopic = { id: string; communityId: string; profileId: string; title: string; content: string; createdAt: number; updatedAt: number; isPinned: boolean; isLocked: boolean }
export type CommunityForumTopicSummary = CommunityForumTopic & { replyCount: number }
export type CommunityForumReply = { id: string; topicId: string; communityId: string; profileId: string; content: string; createdAt: number; updatedAt: number }
export type CommunityForumTopicDetail = { topic: CommunityForumTopicSummary; replies: PaginatedResult<CommunityForumReply> }
export type ProfileMessage = { id: string; fromProfileId: string; toProfileId: string; content: string; createdAt: number }
export type AuthenticatedUser = { id: string; email: string; profiles: string[]; currentProfile: string | null }
export type AuthTokenPair = { accessToken: string; refreshToken: string; expiresIn: number; user: AuthenticatedUser }
export type AuthSession = { user: AuthenticatedUser; authenticatedAt: number }
export type SignInCredentials = { email: string; password: string }
export type SignUpCredentials = SignInCredentials
export type UserPreferences = { language: 'system' | 'pt-BR' | 'en-US'; theme: 'system' | 'light' | 'dark' }
export type ApiErrorResponse = { statusCode: number; message: string | string[]; error?: string }

export type RecentActivity =
  | { id: string; type: 'friend_connected'; updatedAt: number; profile: Profile; friend: Profile }
  | {
      id: string
      type: 'community_membership'
      updatedAt: number
      profile: Profile
      community: Community
      role: Extract<CommunityRelationshipType, 'owner' | 'moderator' | 'connection'>
    }
