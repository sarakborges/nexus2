import type { ActivityFeedCursor, AuthenticatedUser, Community, UserPreferences, CommunitiesPageData, CommunityEditPageData, CommunityForumComposerPageData, CommunityForumPageData, CommunityForumReply, CommunityForumTopic, CommunityForumTopicDetail, CommunityForumTopicSummary, CommunityForumTopicPageData, CommunityMember, CommunityMembersPageData, CommunityPageData, CommunityRelationship, CommunityRelationshipType, ListSort, PaginatedResult, Profile, ProfileDirectoryPageData, ProfileEditPageData, ProfileMessage, ProfileMessagesPageData, ProfilePageData, ProfilePost, ProfileSettings, RecentActivity, Relationship, RelationshipType, SearchResultItem, SearchScope } from '@nexus/common'

export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')

export type AccountRepositoryRecord = AuthenticatedUser & {
  password: { hash: string; salt: string }
  preferences?: UserPreferences
}

export type CollectionRecordMap = Record<string, unknown[]>

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

export type CollectionTransaction<T> = {
  records: CollectionRecordMap
  result: T
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
  ownerUserId: string
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

/**
 * Collection updaters and transaction callbacks must be synchronous and free
 * of external side effects. Optimistic database transactions may rerun them
 * after a concurrent commit.
 */
export interface DataRepository {
  getAccountById(id: string): Promise<AccountRepositoryRecord | null>
  getProfilesByIds?(ids: readonly string[]): Promise<Profile[]>
  getCommunitiesByIds?(ids: readonly string[]): Promise<Community[]>
  read<T>(collection: string): Promise<T[]>
  findAccountByEmail(email: string): Promise<AccountRepositoryRecord | null>
  createAccountWithRefreshToken(change: CreateAccountWithRefreshTokenWrite): Promise<void>
  updateAccountPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>
  createUpload?(change: MediaUploadCreateWrite): Promise<void>
  getUploadById?(userId: string, id: string): Promise<MediaFileRecord | null>
  deletePendingUpload?(userId: string, id: string): Promise<void>
  completeUpload?(change: MediaUploadCompletion): Promise<MediaFileRecord>
  claimExpiredUploads?(change: MediaUploadCleanupRequest): Promise<MediaFileRecord[]>
  finishUploadDeletions?(claims: readonly MediaUploadDeletionClaim[]): Promise<number>
  scheduleUploadDeletion?(change: MediaUploadDeletionSchedule): Promise<boolean>
  claimUploadDeletion?(change: MediaUploadDeletionRequest): Promise<MediaFileRecord | null>
  schedulePreviousAvatarDeletion?(change: PreviousAvatarDeletionSchedule): Promise<void>
  getEditorImageRecord?(change: EditorImageReadRequest): Promise<MediaFileRecord>
  getAvatarUploadPath?(
    userId: string,
    uploadId: string,
    purpose: 'profile-avatar' | 'community-avatar'
  ): Promise<string | null>
  setProfileAvatar?(change: ProfileAvatarWrite): Promise<{ previousPicture: string }>
  setCommunityAvatar?(change: CommunityAvatarWrite): Promise<{ previousPicture: string }>
  createProfile?(change: ProfileCreateWrite): Promise<AuthenticatedUser>
  updateProfile?(
    change: ProfileUpdateWrite
  ): Promise<{ profile: Profile; previousPicture: string | null }>
  createCommunity?(change: CommunityCreateWrite): Promise<Community>
  updateCommunity?(
    change: CommunityUpdateWrite
  ): Promise<{ community: Community; previousPicture: string | null }>
  createProfilePost(
    userId: string,
    post: ProfilePost,
    imageIds: readonly string[]
  ): Promise<ProfilePost>
  issueRefreshToken(
    record: RefreshTokenWrite,
    rotation: RefreshTokenRotation | null,
    now: number
  ): Promise<void>
  deleteRefreshTokenByHash(tokenHash: string): Promise<void>
  changeAccountProfile(change: AccountProfileChange): Promise<void>
  upsertProfileRelationship(change: ProfileRelationshipWrite): Promise<void>
  removeProfileRelationship(change: ProfileRelationshipRemoval): Promise<void>
  changeCommunityRelationship(change: CommunityRelationshipChange): Promise<void>
  getProfileSettings(userId: string, profileId: string): Promise<ProfileSettings>
  updateProfileSettings(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings>
  createProfileMessage(change: ProfileMessageWrite): Promise<ProfileMessage>
  deleteProfileMessage(change: ProfileMessageRemoval): Promise<void>
  setProfileMessageFavorite(change: ProfileMessageFavoriteChange): Promise<ProfileMessage>
  getProfileMessages(
    profileId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<ProfileMessage>>
  getProfilePage?(url: string, userId: string | null): Promise<ProfilePageData>
  listCommunityForumTopics?(
    communityId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<CommunityForumTopicSummary>>
  getCommunityForumTopic?(
    communityId: string,
    topicId: string,
    userId: string | null,
    page: number
  ): Promise<CommunityForumTopicDetail>
  getProfilesPage?(page: number): Promise<PaginatedResult<Profile>>
  getProfileByUrl?(url: string): Promise<Profile>
  getPublicCommunities?(page: number): Promise<PaginatedResult<Community>>
  getOwnedProfiles?(userId: string, page: number): Promise<PaginatedResult<Profile>>
  getCommunityByUrl?(url: string, userId: string | null): Promise<Community>
  getProfileCommunities?(profileId: string, page: number): Promise<PaginatedResult<Community>>
  searchEntities?(query: string, scope: SearchScope, page: number, sort: ListSort): Promise<PaginatedResult<SearchResultItem>>
  getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]>
  getProfileFriends(profileId: string, page: number): Promise<PaginatedResult<Profile>>
  getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]>
  listCommunityMembers(
    communityId: string,
    tab: string,
    page: number,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMember>>
  listPendingMembers(
    userId: string,
    communityId: string,
    actorProfileId: string,
    page: number
  ): Promise<PaginatedResult<CommunityMember>>
  getProfileEditPage?(url: string, userId: string | null): Promise<ProfileEditPageData>
  getCommunityEditPage?(url: string, userId: string | null): Promise<CommunityEditPageData>
  getCommunityForumComposerPage?(url: string, userId: string | null): Promise<CommunityForumComposerPageData>
  getCommunitiesPage?(
    userId: string,
    page: number,
    query: string | undefined,
    sort: ListSort,
    communityTab: 'all' | 'managed'
  ): Promise<CommunitiesPageData>
  getProfileDirectoryPage?(
    url: string,
    kind: 'friends' | 'communities',
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<ProfileDirectoryPageData>
  getCommunityPage?(url: string, userId: string | null): Promise<CommunityPageData>
  getCommunityMembersPage?(
    url: string,
    userId: string | null,
    page: number,
    pendingPage: number,
    query: string | undefined,
    sort: ListSort,
    tab: string | undefined
  ): Promise<CommunityMembersPageData>
  getProfileMessagesPage?(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort,
    messageTab: 'all' | 'favorites'
  ): Promise<ProfileMessagesPageData>
  getCommunityForumPage?(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumPageData>
  getCommunityForumTopicPage?(
    url: string,
    topicId: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumTopicPageData>
  createCommunityForumTopic?(change: CommunityForumTopicWrite): Promise<CommunityForumTopic>
  createCommunityForumReply?(change: CommunityForumReplyWrite): Promise<CommunityForumReply>
  moderateCommunityForumTopic?(change: CommunityForumTopicModerationWrite): Promise<CommunityForumTopic>
  deleteCommunityForumTopic?(change: CommunityForumTopicRemoval): Promise<void>
  deleteCommunityForumReply?(change: CommunityForumReplyRemoval): Promise<string>
  getActivityFeedRows?(
    userId: string,
    limit: number,
    cursor: ActivityFeedCursor | null
  ): Promise<ActivityFeedRow[]>
  readByIds<T extends { id: string }>(collection: string, ids: readonly string[]): Promise<T[]>
  update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]>
  transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => CollectionTransaction<T>
  ): Promise<T>
}
