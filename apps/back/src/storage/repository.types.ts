import type { AuthenticatedUser, Community, CommunityForumReply, CommunityForumTopic, CommunityRelationshipType, Profile, ProfileMessage, RecentActivity, RelationshipType, UserPreferences } from '@nexus/common'
export type { ActivityFeedCursor, AuthenticatedUser, Community, UserPreferences, CommunitiesPageData, CommunityEditPageData, CommunityForumComposerPageData, CommunityForumPageData, CommunityForumReply, CommunityForumTopic, CommunityForumTopicDetail, CommunityForumTopicSummary, CommunityForumTopicPageData, CommunityMember, CommunityMembersPageData, CommunityPageData, CommunityRelationship, CommunityRelationshipType, ListSort, PaginatedResult, Profile, ProfileDirectoryPageData, ProfileEditPageData, ProfileMessage, ProfileMessagesPageData, ProfilePageData, ProfilePost, ProfileSettings, RecentActivity, Relationship, RelationshipType, SearchResultItem, SearchScope } from '@nexus/common'

export type AccountRepositoryRecord = AuthenticatedUser & {
  password: { hash: string; salt: string }
  preferences?: UserPreferences
}

export type RefreshTokenWrite = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: number
}

export type CreateAccountWithRefreshTokenWrite = {
  accountId: string
  email: string
  passwordHash: string
  passwordSalt: string
  refreshToken: RefreshTokenWrite
  now: number
}

export type RefreshTokenRotation = {
  id: string
  userId: string
  tokenHash: string
}

export type AccountProfileChange = {
  accountId: string
  profileId: string
  action: 'select' | 'add' | 'remove'
  makeCurrent: boolean
  previousCurrentProfileId: string | null
}

export type ProfileRelationshipWrite = {
  userId: string
  sourceProfileId: string
  targetProfileId: string
  type: RelationshipType
  updatedAt: number
}

export type ProfileRelationshipRemoval = {
  userId: string
  sourceProfileId: string
  targetProfileId: string
  updatedAt: number
}

export type CommunityRelationshipAction =
  | CommunityRelationshipType
  | 'remove'
  | 'demote'
  | 'transfer'

export type CommunityRelationshipChange = {
  userId: string
  communityId: string
  targetProfileId: string
  actorProfileId: string
  action: CommunityRelationshipAction
  updatedAt: number
}

export type ProfileMessageWrite = {
  userId: string
  message: ProfileMessage
  imageIds: readonly string[]
}

export type ProfileMessageRemoval = {
  userId: string
  recipientProfileId: string
  messageId: string
  actorProfileId: string
}

export type ProfileMessageFavoriteChange = {
  userId: string
  recipientProfileId: string
  messageId: string
  actorProfileId: string
  isFavorite: boolean
}

export type CommunityForumTopicWrite = {
  userId: string
  topic: CommunityForumTopic
  imageIds: readonly string[]
}

export type CommunityForumReplyWrite = {
  userId: string
  reply: CommunityForumReply
  imageIds: readonly string[]
}

export type CommunityForumTopicModerationWrite = {
  userId: string
  communityId: string
  topicId: string
  actorProfileId: string
  isPinned?: boolean
  isLocked?: boolean
  updatedAt: number
}

export type CommunityForumTopicRemoval = {
  userId: string
  communityId: string
  topicId: string
  actorProfileId: string
  updatedAt: number
}

export type CommunityForumReplyRemoval = {
  userId: string
  communityId: string
  replyId: string
  actorProfileId: string
  updatedAt: number
}

export type ProfileAvatarWrite = {
  userId: string
  profileId: string
  uploadId: string | null
  picture: string
}

export type CommunityAvatarWrite = {
  userId: string
  communityId: string
  actorProfileId: string
  uploadId: string | null
  picture: string
}

export type ProfileCreateWrite = {
  userId: string
  profile: Profile
  avatarPath: string | null
  editorImageIds: readonly string[]
}

export type ProfileUpdateWrite = {
  userId: string
  profileId: string
  name: string
  url: string
  picture: string
  about: string
  lastActivity: number
  avatarPath: string | null
  editorImageIds: readonly string[]
}

export type CommunityCreateWrite = {
  userId: string
  ownerProfileId: string
  id: string
  name: string
  url: string
  picture: string
  about: string
  privacy: Community['privacy']
  createdAt: number
  avatarPath: string | null
  editorImageIds: readonly string[]
}

export type CommunityUpdateWrite = {
  userId: string
  communityId: string
  name: string
  url: string
  picture: string
  about: string
  privacy: Community['privacy'] | null
  lastActivity: number
  avatarPath: string | null
  editorImageIds: readonly string[]
}


export type MediaFileRecord = {
  id: string
  ownerUserId: string | null
  purpose: 'profile-avatar' | 'community-avatar' | 'editor-image'
  bucket: string
  path: string
  contentType: string
  expectedSize: number
  size: number | null
  status: 'pending' | 'ready' | 'deleting'
  deletingAt?: number | null
  deleteAfter?: number | null
  createdAt: number
  completedAt: number | null
  expiresAt: number | null
  resourceType: 'profile' | 'community' | 'profile-message' | 'profile-post' | 'community-forum-topic' | 'community-forum-reply' | null
  resourceId: string | null
  messageFromProfileId: string | null
  messageToProfileId: string | null
}

export type MediaUploadCreateWrite = {
  record: MediaFileRecord
  targetId: string | null
  actorProfileId: string | null
}

export type MediaUploadCompletion = {
  userId: string
  id: string
  size: number
  completedAt: number
  expiresAt: number | null
  pendingMaxAge: number
}

export type MediaUploadDeletionClaim = { id: string; deletingAt: number }
export type MediaUploadDeletionSchedule = {
  id: string
  userId: string
  scheduledAt: number
  allowReady: boolean
  safeAge: number
  leaseMs: number
}
export type MediaUploadDeletionRequest = {
  id: string
  userId: string
  deletingAt: number
  expectedStatus?: 'pending'
}
export type MediaUploadCleanupRequest = {
  now: number
  claimLeaseMs: number
  safeAge: number
  orphanAvatarRetentionMs: number
  limit: number
}
export type PreviousAvatarDeletionSchedule = {
  path: string
  keepId: string | null
  deletingAt: number
  safeAge: number
  leaseMs: number
}
export type EditorImageReadRequest = { userId: string | null; id: string; now: number }

export type ActivityFeedRow = {
  id: string
  type: RecentActivity['type']
  updated_at_ms: number
  profile: Profile
  friend: Profile | null
  community: Community | null
  content: string | null
  role: 'owner' | 'moderator' | 'connection' | null
}
