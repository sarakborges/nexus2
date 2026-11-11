import type { ActivityFeedCursor, Community, CommunityForumReply, CommunityForumTopic, CommunityRelationshipType, PaginatedResult, Profile, ProfileMessage, ProfilePost, ProfileSettings, RecentActivity, RelationshipType } from '@nexus/common'

export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')

export type CollectionRecordMap = Record<string, unknown[]>

export type RefreshTokenWrite = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: number
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
  read<T>(collection: string): Promise<T[]>
  findAccountByEmail?<T>(email: string): Promise<T | null>
  createProfilePost?(
    userId: string,
    post: ProfilePost,
    imageIds: readonly string[]
  ): Promise<ProfilePost>
  issueRefreshToken?(
    record: RefreshTokenWrite,
    rotation: RefreshTokenRotation | null,
    now: number
  ): Promise<void>
  deleteRefreshTokenByHash?(tokenHash: string): Promise<void>
  changeAccountProfile?(change: AccountProfileChange): Promise<void>
  upsertProfileRelationship?(change: ProfileRelationshipWrite): Promise<void>
  removeProfileRelationship?(change: ProfileRelationshipRemoval): Promise<void>
  changeCommunityRelationship?(change: CommunityRelationshipChange): Promise<void>
  getProfileSettings?(userId: string, profileId: string): Promise<ProfileSettings>
  updateProfileSettings?(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings>
  createProfileMessage?(change: ProfileMessageWrite): Promise<ProfileMessage>
  deleteProfileMessage?(change: ProfileMessageRemoval): Promise<void>
  setProfileMessageFavorite?(change: ProfileMessageFavoriteChange): Promise<ProfileMessage>
  getProfileMessages?(
    profileId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<ProfileMessage>>
  createCommunityForumTopic?(change: CommunityForumTopicWrite): Promise<CommunityForumTopic>
  createCommunityForumReply?(change: CommunityForumReplyWrite): Promise<CommunityForumReply>
  moderateCommunityForumTopic?(change: CommunityForumTopicModerationWrite): Promise<CommunityForumTopic>
  deleteCommunityForumTopic?(change: CommunityForumTopicRemoval): Promise<void>
  deleteCommunityForumReply?(change: CommunityForumReplyRemoval): Promise<string>
  getActivityFeedRows?
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
