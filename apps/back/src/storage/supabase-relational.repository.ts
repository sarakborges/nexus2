import type { ActivityFeedCursor, AuthenticatedUser, Community, PaginatedResult, Profile, CommunitiesPageData, CommunityEditPageData, CommunityForumComposerPageData, CommunityForumPageData, CommunityForumReply, CommunityForumTopic, CommunityForumTopicDetail, CommunityForumTopicSummary, CommunityForumTopicPageData, CommunityMember, CommunityMembersPageData, CommunityPageData, CommunityRelationship, ListSort, ProfileDirectoryPageData, ProfileEditPageData, ProfileMessage, ProfileMessagesPageData, ProfilePageData, ProfilePost, ProfileSettings, Relationship, SearchResultItem, SearchScope } from '@nexus/common'
import type {
  CollectionRecordMap,
  DataRepository,
  ActivityFeedRow,
  AccountProfileChange,
  ProfileAvatarWrite,
  CommunityAvatarWrite,
  ProfileCreateWrite,
  ProfileUpdateWrite,
  CommunityCreateWrite,
  CommunityUpdateWrite,
  ProfileRelationshipRemoval,
  ProfileRelationshipWrite,
  CommunityRelationshipChange,
  ProfileMessageWrite,
  ProfileMessageRemoval,
  ProfileMessageFavoriteChange,
  CommunityForumTopicWrite,
  CommunityForumReplyWrite,
  CommunityForumTopicModerationWrite,
  CommunityForumTopicRemoval,
  CommunityForumReplyRemoval,
  RefreshTokenRotation,
  RefreshTokenWrite
} from './repository.interface'

type DatabaseRow = Record<string, unknown>
type CollectionSnapshot = {
  records: unknown[]
  revision: number
}

const MAX_UPDATE_ATTEMPTS = 8
const PAGE_SIZE = 1000

const WRITE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'relationships',
  'community_relationships',
  'profile_posts',
  'profile_settings',
  'profile_messages',
  'community_forum_topics',
  'community_forum_replies',
  'refresh_tokens',
  'media_files'
] as const

const READ_COLLECTIONS = [...WRITE_COLLECTIONS, 'feed_activities'] as const

export class SupabaseRelationalRepository implements DataRepository {
  private readonly baseUrl: string

  constructor(
    projectUrl: string,
    private readonly publishableKey: string,
    private readonly apiSecret: string
  ) {
    this.baseUrl = projectUrl.replace(/\/+$/, '')
  }

  async read<T>(collection: string): Promise<T[]> {
    this.assertReadableCollection(collection)
    if (collection === 'feed_activities') {
      return await this.readCollection(collection) as T[]
    }
    const snapshots = await this.readSnapshots([collection])
    return snapshots.get(collection)!.records as T[]
  }

  async readByIds<T extends { id: string }>(
    collection: string,
    ids: readonly string[]
  ): Promise<T[]> {
    const requestedIds = [...new Set(ids)]
    if (requestedIds.length === 0) return []

    switch (collection) {
      case 'accounts':
        return await this.readAccounts(
          await this.selectRowsByValues('accounts', 'id', requestedIds)
        ) as T[]
      case 'profiles':
        return (await this.selectRowsByValues('profiles', 'id', requestedIds)).map(row => ({
          id: this.string(row.id),
          name: this.string(row.name),
          url: this.string(row.url),
          picture: this.string(row.picture),
          about: this.string(row.about),
          type: this.string(row.type),
          createdAt: this.number(row.created_at_ms),
          lastActivity: this.number(row.last_activity_ms)
        })) as unknown as T[]
      case 'communities':
        return (await this.selectRowsByValues('communities', 'id', requestedIds)).map(row => ({
          id: this.string(row.id),
          name: this.string(row.name),
          url: this.string(row.url),
          picture: this.string(row.picture),
          about: this.string(row.about),
          type: this.string(row.type),
          privacy: this.string(row.privacy),
          createdAt: this.number(row.created_at_ms),
          lastActivity: this.number(row.last_activity_ms)
        })) as unknown as T[]
      default: {
        const requested = new Set(requestedIds)
        return (await this.read<T>(collection)).filter(record => requested.has(record.id))
      }
    }
  }

  async findAccountByEmail<T>(email: string): Promise<T | null> {
    const rows = await this.selectRowsByField('accounts', 'email', 'eq.' + email)
    const [account] = await this.readAccounts(rows)
    return (account as T | undefined) ?? null
  }

  async createProfilePost(
    userId: string,
    post: ProfilePost,
    imageIds: readonly string[]
  ): Promise<ProfilePost> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_profile_post', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_post_id: post.id,
        p_profile_id: post.profileId,
        p_content: post.content,
        p_created_at_ms: post.createdAt,
        p_image_ids: [...imageIds]
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational profile post write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms))
    ) {
      throw new Error('Supabase relational profile post write returned an invalid row.')
    }
    return {
      id: row.id,
      profileId: row.profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms)
    }
  }

  async getAvatarUploadPath(
    userId: string,
    uploadId: string,
    purpose: 'profile-avatar' | 'community-avatar'
  ): Promise<string | null> {
    const url = new URL(this.baseUrl + '/rest/v1/media_files')
    url.searchParams.set('select','path')
    url.searchParams.set('id','eq.' + uploadId)
    url.searchParams.set('owner_user_id','eq.' + userId)
    url.searchParams.set('purpose','eq.' + purpose)
    const response = await fetch(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) throw new Error('Supabase avatar upload lookup returned an invalid result.')
    const row = rows[0] as DatabaseRow | undefined
    return typeof row?.path === 'string' ? row.path : null
  }

  async setProfileAvatar(change: ProfileAvatarWrite): Promise<{ previousPicture: string }> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_set_profile_avatar', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_profile_id: change.profileId,
        p_upload_id: change.uploadId,
        p_picture: change.picture
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0]?.previous_picture !== 'string') {
      throw new Error('Supabase relational profile avatar write returned an invalid result.')
    }
    return { previousPicture: rows[0].previous_picture }
  }

  async setCommunityAvatar(change: CommunityAvatarWrite): Promise<{ previousPicture: string }> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_set_community_avatar', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_actor_profile_id: change.actorProfileId,
        p_upload_id: change.uploadId,
        p_picture: change.picture
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0]?.previous_picture !== 'string') {
      throw new Error('Supabase relational community avatar write returned an invalid result.')
    }
    return { previousPicture: rows[0].previous_picture }
  }

  async createProfile(change: ProfileCreateWrite): Promise<AuthenticatedUser> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_profile', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_profile_id: change.profile.id,
        p_name: change.profile.name,
        p_url: change.profile.url,
        p_picture: change.profile.picture,
        p_about: change.profile.about,
        p_type: change.profile.type,
        p_created_at_ms: change.profile.createdAt,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational profile creation returned an invalid result.')
    }
    const row = rows[0] as DatabaseRow
    if (
      typeof row.account_id !== 'string' ||
      typeof row.email !== 'string' ||
      !Array.isArray(row.profiles) ||
      !row.profiles.every(profileId => typeof profileId === 'string') ||
      (row.current_profile_id !== null && typeof row.current_profile_id !== 'string')
    ) {
      throw new Error('Supabase relational profile creation returned an invalid account row.')
    }
    return {
      id: row.account_id,
      email: row.email,
      profiles: row.profiles as string[],
      currentProfile: row.current_profile_id as string | null
    }
  }

  async updateProfile(change: ProfileUpdateWrite): Promise<{ profile: Profile; previousPicture: string | null }> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_update_profile', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_profile_id: change.profileId,
        p_name: change.name,
        p_url: change.url,
        p_picture: change.picture,
        p_about: change.about,
        p_last_activity_ms: change.lastActivity,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational profile update returned an invalid result.')
    }
    const row = rows[0] as DatabaseRow
    return {
      profile: this.mapProfile(row),
      previousPicture: typeof row.previous_picture === 'string' ? row.previous_picture : null
    }
  }

  async createCommunity(change: CommunityCreateWrite): Promise<Community> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_community', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_owner_profile_id: change.ownerProfileId,
        p_community_id: change.id,
        p_name: change.name,
        p_url: change.url,
        p_picture: change.picture,
        p_about: change.about,
        p_privacy: change.privacy,
        p_created_at_ms: change.createdAt,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational community creation returned an invalid result.')
    }
    return this.mapCommunity(rows[0] as DatabaseRow)
  }

  async updateCommunity(change: CommunityUpdateWrite): Promise<{ community: Community; previousPicture: string | null }> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_update_community', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_name: change.name,
        p_url: change.url,
        p_picture: change.picture,
        p_about: change.about,
        p_privacy: change.privacy,
        p_last_activity_ms: change.lastActivity,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational community update returned an invalid result.')
    }
    const row = rows[0] as DatabaseRow
    return {
      community: this.mapCommunity(row),
      previousPicture: typeof row.previous_picture === 'string' ? row.previous_picture : null
    }
  }

  async issueRefreshToken(
    record: RefreshTokenWrite,
    rotation: RefreshTokenRotation | null,
    now: number
  ): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_issue_refresh_token', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_id: record.id,
        p_user_id: record.userId,
        p_token_hash: record.tokenHash,
        p_expires_at_ms: record.expiresAt,
        p_now_ms: now,
        p_previous_id: rotation?.id ?? null,
        p_previous_user_id: rotation?.userId ?? null,
        p_previous_token_hash: rotation?.tokenHash ?? null
      })
    })
    await this.assertSuccess(response)
  }

  async deleteRefreshTokenByHash(tokenHash: string): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_revoke_refresh_token', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token_hash: tokenHash })
    })
    await this.assertSuccess(response)
  }

  async changeAccountProfile(change: AccountProfileChange): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_change_account_profile', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_account_id: change.accountId,
        p_profile_id: change.profileId,
        p_action: change.action,
        p_make_current: change.makeCurrent,
        p_previous_current_profile_id: change.previousCurrentProfileId
      })
    })
    await this.assertSuccess(response)
  }

  async upsertProfileRelationship(change: ProfileRelationshipWrite): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_upsert_profile_relationship', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_source_profile_id: change.sourceProfileId,
        p_target_profile_id: change.targetProfileId,
        p_type: change.type,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async removeProfileRelationship(change: ProfileRelationshipRemoval): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_remove_profile_relationship', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_source_profile_id: change.sourceProfileId,
        p_target_profile_id: change.targetProfileId,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async changeCommunityRelationship(change: CommunityRelationshipChange): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_change_community_relationship', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_target_profile_id: change.targetProfileId,
        p_actor_profile_id: change.actorProfileId,
        p_action: change.action,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async getProfileSettings(userId: string, profileId: string): Promise<ProfileSettings> {
    return this.requestProfileSettings('nexus_get_profile_settings', {
      p_user_id: userId,
      p_profile_id: profileId
    })
  }

  async updateProfileSettings(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings> {
    return this.requestProfileSettings('nexus_update_profile_settings', {
      p_user_id: userId,
      p_profile_id: profileId,
      p_patch: patch
    })
  }

  private async requestProfileSettings(
    rpcName: string,
    body: Record<string, unknown>
  ): Promise<ProfileSettings> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/' + rpcName, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase profile settings RPC returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    const allowed = new Set([
      'friend_connected',
      'profile_post',
      'community_created',
      'community_membership'
    ])
    if (
      (row.message_audience !== 'friends' && row.message_audience !== 'everyone') ||
      !Array.isArray(row.publish_activity_types) ||
      !row.publish_activity_types.every(item => typeof item === 'string' && allowed.has(item)) ||
      !Array.isArray(row.show_friend_activity_types) ||
      !row.show_friend_activity_types.every(item => typeof item === 'string' && allowed.has(item))
    ) {
      throw new Error('Supabase profile settings RPC returned an invalid settings row.')
    }

    return {
      messageAudience: row.message_audience,
      publishActivityTypes: row.publish_activity_types as ProfileSettings['publishActivityTypes'],
      showFriendActivityTypes: row.show_friend_activity_types as ProfileSettings['showFriendActivityTypes']
    }
  }

  async createProfileMessage(change: ProfileMessageWrite): Promise<ProfileMessage> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_send_profile_message', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_message_id: change.message.id,
        p_from_profile_id: change.message.fromProfileId,
        p_to_profile_id: change.message.toProfileId,
        p_content: change.message.content,
        p_created_at_ms: change.message.createdAt,
        p_image_ids: [...change.imageIds]
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase profile message write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.from_profile_id !== 'string' ||
      typeof row.to_profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      typeof row.is_favorite !== 'boolean'
    ) {
      throw new Error('Supabase profile message write returned an invalid row.')
    }
    return {
      id: row.id,
      fromProfileId: row.from_profile_id,
      toProfileId: row.to_profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      isFavorite: row.is_favorite
    }
  }

  async deleteProfileMessage(change: ProfileMessageRemoval): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_profile_message', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_recipient_profile_id: change.recipientProfileId,
        p_message_id: change.messageId,
        p_actor_profile_id: change.actorProfileId
      })
    })
    await this.assertSuccess(response)
  }

  async setProfileMessageFavorite(change: ProfileMessageFavoriteChange): Promise<ProfileMessage> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_set_profile_message_favorite', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_recipient_profile_id: change.recipientProfileId,
        p_message_id: change.messageId,
        p_actor_profile_id: change.actorProfileId,
        p_is_favorite: change.isFavorite
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase profile message favorite returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.from_profile_id !== 'string' ||
      typeof row.to_profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      typeof row.is_favorite !== 'boolean'
    ) {
      throw new Error('Supabase profile message favorite returned an invalid row.')
    }
    return {
      id: row.id,
      fromProfileId: row.from_profile_id,
      toProfileId: row.to_profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      isFavorite: row.is_favorite
    }
  }

  async getProfileMessages(
    profileId: string,
    userId: string | null,
    page: number
  ): Promise<import('@nexus/common').PaginatedResult<ProfileMessage>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_messages', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_profile_id: profileId,
        p_user_id: userId,
        p_page: page
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) {
      throw new Error('Supabase profile messages read returned an invalid page.')
    }
    if (rows.length === 0) {
      return { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
    }

    const metadata = rows[0] as Record<string, unknown>
    const totalItems = Number(metadata.total_items)
    const currentPage = Number(metadata.page)
    const pageSize = Number(metadata.page_size)
    const totalPages = Number(metadata.total_pages)
    if (
      !Number.isSafeInteger(totalItems) || totalItems < 1 ||
      !Number.isSafeInteger(currentPage) || currentPage < 1 ||
      pageSize !== 20 ||
      !Number.isSafeInteger(totalPages) || totalPages < 1
    ) {
      throw new Error('Supabase profile messages read returned invalid pagination metadata.')
    }

    const items = rows.map(value => {
      const row = value as Record<string, unknown>
      if (
        typeof row.id !== 'string' ||
        typeof row.from_profile_id !== 'string' ||
        typeof row.to_profile_id !== 'string' ||
        typeof row.content !== 'string' ||
        !Number.isFinite(Number(row.created_at_ms)) ||
        typeof row.is_favorite !== 'boolean'
      ) {
        throw new Error('Supabase profile messages read returned an invalid row.')
      }
      return {
        id: row.id,
        fromProfileId: row.from_profile_id,
        toProfileId: row.to_profile_id,
        content: row.content,
        createdAt: Number(row.created_at_ms),
        isFavorite: row.is_favorite
      }
    })

    return {
      items,
      page: currentPage,
      pageSize,
      totalItems,
      totalPages
    }
  }

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_relationships', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_profile_id: profileId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (!Array.isArray(result)) throw new Error('Supabase profile relationships returned an invalid result.')
    return result as Relationship[]
  }

  async getProfileFriends(profileId: string, page: number): Promise<PaginatedResult<Profile>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_friends', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_profile_id: profileId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase profile friends returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase profile friends returned invalid pagination data.')
    }
    return result as PaginatedResult<Profile>
  }

  async getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_relationships', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_community_id: communityId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (!Array.isArray(result)) throw new Error('Supabase community relationships returned an invalid result.')
    return result as CommunityRelationship[]
  }

  async listCommunityMembers(
    communityId: string,
    tab: string,
    page: number,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMember>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_list_community_members', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_community_id: communityId,
        p_tab: tab,
        p_user_id: userId,
        p_actor_profile_id: actorProfileId ?? null,
        p_page: page
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase community members returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase community members returned invalid pagination data.')
    }
    return result as PaginatedResult<CommunityMember>
  }

  async listPendingMembers(
    userId: string,
    communityId: string,
    actorProfileId: string,
    page: number
  ): Promise<PaginatedResult<CommunityMember>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_list_pending_members', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_community_id: communityId,
        p_actor_profile_id: actorProfileId,
        p_page: page
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase pending members returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase pending members returned invalid pagination data.')
    }
    return result as PaginatedResult<CommunityMember>
  }

  async getProfilesPage(page: number): Promise<PaginatedResult<Profile>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_list_profiles', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase profile list returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase profile list returned invalid pagination data.')
    }
    return result as PaginatedResult<Profile>
  }

  async getProfileByUrl(url: string): Promise<Profile> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_by_url', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('id' in result) || !('type' in result)) {
      throw new Error('Supabase profile lookup returned an invalid result.')
    }
    return result as Profile
  }

  async getPublicCommunities(page: number): Promise<PaginatedResult<Community>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_list_public_communities', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase public community list returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase public community list returned invalid pagination data.')
    }
    return result as PaginatedResult<Community>
  }

  async getOwnedProfiles(userId: string, page: number): Promise<PaginatedResult<Profile>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_owned_profiles', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase owned profiles returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase owned profiles returned invalid pagination data.')
    }
    return result as PaginatedResult<Profile>
  }

  async getCommunityByUrl(url: string, userId: string | null): Promise<Community> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_by_url', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('id' in result) || !('privacy' in result)) {
      throw new Error('Supabase community lookup returned an invalid result.')
    }
    return result as Community
  }

  async getProfileCommunities(profileId: string, page: number): Promise<PaginatedResult<Community>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_communities', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_profile_id: profileId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase profile communities returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase profile communities returned invalid pagination data.')
    }
    return result as PaginatedResult<Community>
  }

  async searchEntities(query: string, scope: SearchScope, page: number, sort: ListSort): Promise<PaginatedResult<SearchResultItem>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_search_entities', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_query: query, p_scope: scope, p_page: page, p_sort: sort })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase entity search returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase entity search returned invalid pagination data.')
    }
    return result as PaginatedResult<SearchResultItem>
  }

  async listCommunityForumTopics(
    communityId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_topics', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_community_id: communityId, p_user_id: userId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase forum topics returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase forum topics returned invalid pagination data.')
    }
    return result as PaginatedResult<CommunityForumTopicSummary>
  }

  async getCommunityForumTopic(
    communityId: string,
    topicId: string,
    userId: string | null,
    page: number
  ): Promise<CommunityForumTopicDetail> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_community_id: communityId,
        p_topic_id: topicId,
        p_user_id: userId,
        p_page: page
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('topic' in result) || !('replies' in result)) {
      throw new Error('Supabase forum topic returned an invalid result.')
    }
    return result as CommunityForumTopicDetail
  }

  async getProfileEditPage(url: string, userId: string | null): Promise<ProfileEditPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_edit_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('profile' in result) || !('currentProfileType' in result)) {
      throw new Error('Supabase profile edit page returned an invalid result.')
    }
    return result as ProfileEditPageData
  }

  async getCommunityEditPage(url: string, userId: string | null): Promise<CommunityEditPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_edit_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('community' in result) || !('ownerProfileId' in result) || !('currentProfileType' in result)) {
      throw new Error('Supabase community edit page returned an invalid result.')
    }
    return result as CommunityEditPageData
  }

  async getCommunityForumComposerPage(url: string, userId: string | null): Promise<CommunityForumComposerPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_composer_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('community' in result) || !('forumProfile' in result) || !('viewerRelationship' in result) || !('currentProfileType' in result)) {
      throw new Error('Supabase community forum composer page returned an invalid result.')
    }
    return result as CommunityForumComposerPageData
  }

  async getCommunitiesPage(
    userId: string,
    page: number,
    query: string | undefined,
    sort: ListSort,
    communityTab: 'all' | 'managed'
  ): Promise<CommunitiesPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_communities_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort,
        p_community_tab: communityTab
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase communities page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const communities = record.communities as Record<string, unknown> | null
    if (
      !communities || typeof communities !== 'object' ||
      !Array.isArray(communities.items) ||
      (record.communityTab !== 'all' && record.communityTab !== 'managed') ||
      !('currentProfile' in record)
    ) {
      throw new Error('Supabase communities page returned invalid data.')
    }
    const pageResult = result as CommunitiesPageData
    if (
      pageResult.communities.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.communities.totalItems) ||
      !Number.isSafeInteger(pageResult.communities.totalPages)
    ) {
      throw new Error('Supabase communities page returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getProfileDirectoryPage(
    url: string,
    kind: 'friends' | 'communities',
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<ProfileDirectoryPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_directory_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_kind: kind,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase profile directory page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    if (
      record.kind !== kind ||
      !('profile' in record) ||
      !('viewerRelationship' in record) ||
      !('currentProfileType' in record)
    ) {
      throw new Error('Supabase profile directory page returned invalid identity data.')
    }

    if (kind === 'friends') {
      const friends = record.friends as Record<string, unknown> | null
      if (
        !Array.isArray(record.friendRelationships) ||
        !friends || typeof friends !== 'object' ||
        !Array.isArray(friends.items)
      ) {
        throw new Error('Supabase friends directory returned invalid data.')
      }
      const pageResult = result as Extract<ProfileDirectoryPageData, { kind: 'friends' }>
      if (
        pageResult.friends.pageSize !== 20 ||
        !Number.isSafeInteger(pageResult.friends.totalItems) ||
        !Number.isSafeInteger(pageResult.friends.totalPages)
      ) {
        throw new Error('Supabase friends directory returned invalid pagination metadata.')
      }
      return pageResult
    }

    const communities = record.communities as Record<string, unknown> | null
    if (!communities || typeof communities !== 'object' || !Array.isArray(communities.items)) {
      throw new Error('Supabase communities directory returned invalid data.')
    }
    const pageResult = result as Extract<ProfileDirectoryPageData, { kind: 'communities' }>
    if (
      pageResult.communities.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.communities.totalItems) ||
      !Number.isSafeInteger(pageResult.communities.totalPages)
    ) {
      throw new Error('Supabase communities directory returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getCommunityMembersPage(
    url: string,
    userId: string | null,
    page: number,
    pendingPage: number,
    query: string | undefined,
    sort: ListSort,
    tab: string | undefined
  ): Promise<CommunityMembersPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_members_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_user_id: userId,
        p_page: page,
        p_pending_page: pendingPage,
        p_query: query ?? null,
        p_sort: sort,
        p_tab: tab ?? null
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase community members page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const members = record.members as Record<string, unknown> | null
    const pending = record.pending as Record<string, unknown> | null
    if (
      !Array.isArray(record.relationships) ||
      !members || typeof members !== 'object' || !Array.isArray(members.items) ||
      !pending || typeof pending !== 'object' || !Array.isArray(pending.items) ||
      typeof record.isStaff !== 'boolean' ||
      !['all', 'staff', 'banned'].includes(String(record.visibleTab))
    ) {
      throw new Error('Supabase community members page returned invalid data.')
    }
    const pageResult = result as CommunityMembersPageData
    if (
      pageResult.members.pageSize !== 20 ||
      pageResult.pending.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.members.totalItems) ||
      !Number.isSafeInteger(pageResult.pending.totalItems)
    ) {
      throw new Error('Supabase community members page returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getCommunityPage(url: string, userId: string | null): Promise<CommunityPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase community page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const members = record.members as Record<string, unknown> | null
    const forumTopics = record.forumTopics as Record<string, unknown> | null
    if (
      !Array.isArray(record.relationships) ||
      !members || typeof members !== 'object' ||
      !Array.isArray(members.items) ||
      !forumTopics || typeof forumTopics !== 'object' ||
      !Array.isArray(forumTopics.items) ||
      !Array.isArray(record.forumAuthors) ||
      typeof record.canViewMembers !== 'boolean' ||
      typeof record.canEditCommunity !== 'boolean' ||
      !Number.isSafeInteger(record.pendingRequestCount)
    ) {
      throw new Error('Supabase community page returned invalid data.')
    }

    const pageResult = result as CommunityPageData
    if (
      pageResult.members.pageSize !== 20 ||
      pageResult.forumTopics.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.members.totalItems) ||
      !Number.isSafeInteger(pageResult.forumTopics.totalItems)
    ) {
      throw new Error('Supabase community page returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getProfileMessagesPage(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort,
    messageTab: 'all' | 'favorites'
  ): Promise<ProfileMessagesPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_messages_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort,
        p_message_tab: messageTab
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase profile messages page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const messages = record.messages as Record<string, unknown> | null
    if (
      !messages || typeof messages !== 'object' ||
      !Array.isArray(messages.items) ||
      !Array.isArray(record.senders) ||
      typeof record.messagePermissions !== 'object' ||
      record.messagePermissions === null ||
      typeof record.isProfileOwner !== 'boolean' ||
      (record.messageTab !== 'all' && record.messageTab !== 'favorites')
    ) {
      throw new Error('Supabase profile messages page returned invalid data.')
    }
    const pageResult = result as ProfileMessagesPageData
    if (
      pageResult.messages.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.messages.totalItems) ||
      !Number.isSafeInteger(pageResult.messages.totalPages)
    ) {
      throw new Error('Supabase profile messages page returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getProfilePage(url: string, userId: string | null): Promise<ProfilePageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase profile page returned an invalid result.')
    }
    const resultRecord = result as Record<string, unknown>
    const friendsPage = resultRecord.friends as Record<string, unknown> | null
    const communitiesPage = resultRecord.communities as Record<string, unknown> | null
    if (
      !friendsPage || typeof friendsPage !== 'object' ||
      !communitiesPage || typeof communitiesPage !== 'object' ||
      !Array.isArray(friendsPage.items) ||
      !Array.isArray(communitiesPage.items)
    ) {
      throw new Error('Supabase profile page returned an invalid result.')
    }
    const pageResult = result as ProfilePageData
    if (
      pageResult.friends.pageSize !== 20 ||
      pageResult.communities.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.friends.totalItems) ||
      !Number.isSafeInteger(pageResult.communities.totalItems)
    ) {
      throw new Error('Supabase profile page returned invalid pagination data.')
    }
    return pageResult
  }

  async getCommunityForumPage(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (
      typeof result !== 'object' || result === null ||
      !('canReadForum' in result) || typeof result.canReadForum !== 'boolean' ||
      !('canPublish' in result) || typeof result.canPublish !== 'boolean' ||
      !('topics' in result) || typeof result.topics !== 'object' || result.topics === null ||
      !('authors' in result) || !Array.isArray(result.authors)
    ) {
      throw new Error('Supabase community forum page returned an invalid result.')
    }
    const pageResult = result as CommunityForumPageData
    if (
      !pageResult.topics ||
      !Array.isArray(pageResult.topics.items) ||
      pageResult.topics.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.topics.totalItems) ||
      !Number.isSafeInteger(pageResult.topics.totalPages) ||
      (pageResult.community !== null && typeof pageResult.community !== 'object') ||
      (pageResult.viewerRelationship !== null && typeof pageResult.viewerRelationship !== 'object') ||
      (pageResult.currentProfileType !== null && typeof pageResult.currentProfileType !== 'string')
    ) {
      throw new Error('Supabase community forum page returned invalid data.')
    }
    return pageResult
  }

  async getCommunityForumTopicPage(
    url: string,
    topicId: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumTopicPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_topic_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_topic_id: topicId,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (
      typeof result !== 'object' || result === null ||
      !('community' in result) || typeof result.community !== 'object' || result.community === null ||
      !('detail' in result) || typeof result.detail !== 'object' || result.detail === null ||
      !('authors' in result) || !Array.isArray(result.authors) ||
      !('isMember' in result) || typeof result.isMember !== 'boolean' ||
      !('isStaff' in result) || typeof result.isStaff !== 'boolean' ||
      !('forumProfileId' in result)
    ) {
      throw new Error('Supabase community forum topic page returned an invalid result.')
    }
    const pageResult = result as CommunityForumTopicPageData
    if (
      !pageResult.detail.topic ||
      !pageResult.detail.replies ||
      !Array.isArray(pageResult.detail.replies.items) ||
      pageResult.detail.replies.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.detail.replies.totalItems) ||
      !Number.isSafeInteger(pageResult.detail.replies.totalPages)
    ) {
      throw new Error('Supabase community forum topic page returned invalid data.')
    }
    return pageResult
  }

  async createCommunityForumTopic(change: CommunityForumTopicWrite): Promise<CommunityForumTopic> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_topic_id: change.topic.id,
        p_community_id: change.topic.communityId,
        p_profile_id: change.topic.profileId,
        p_title: change.topic.title,
        p_content: change.topic.content,
        p_created_at_ms: change.topic.createdAt,
        p_image_ids: [...change.imageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase forum topic write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.community_id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.updated_at_ms)) ||
      typeof row.is_pinned !== 'boolean' ||
      typeof row.is_locked !== 'boolean'
    ) throw new Error('Supabase forum topic write returned an invalid row.')
    return {
      id: row.id,
      communityId: row.community_id,
      profileId: row.profile_id,
      title: row.title,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      updatedAt: Number(row.updated_at_ms),
      isPinned: row.is_pinned,
      isLocked: row.is_locked
    }
  }

  async createCommunityForumReply(change: CommunityForumReplyWrite): Promise<CommunityForumReply> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_community_forum_reply', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_reply_id: change.reply.id,
        p_topic_id: change.reply.topicId,
        p_community_id: change.reply.communityId,
        p_profile_id: change.reply.profileId,
        p_content: change.reply.content,
        p_created_at_ms: change.reply.createdAt,
        p_updated_at_ms: change.reply.updatedAt,
        p_image_ids: [...change.imageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase forum reply write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.topic_id !== 'string' ||
      typeof row.community_id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.updated_at_ms))
    ) throw new Error('Supabase forum reply write returned an invalid row.')
    return {
      id: row.id,
      topicId: row.topic_id,
      communityId: row.community_id,
      profileId: row.profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      updatedAt: Number(row.updated_at_ms)
    }
  }

  async moderateCommunityForumTopic(change: CommunityForumTopicModerationWrite): Promise<CommunityForumTopic> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_moderate_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_topic_id: change.topicId,
        p_actor_profile_id: change.actorProfileId,
        p_is_pinned: change.isPinned ?? null,
        p_is_locked: change.isLocked ?? null,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase forum topic moderation returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.community_id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.updated_at_ms)) ||
      typeof row.is_pinned !== 'boolean' ||
      typeof row.is_locked !== 'boolean'
    ) throw new Error('Supabase forum topic moderation returned an invalid row.')
    return {
      id: row.id,
      communityId: row.community_id,
      profileId: row.profile_id,
      title: row.title,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      updatedAt: Number(row.updated_at_ms),
      isPinned: row.is_pinned,
      isLocked: row.is_locked
    }
  }

  async deleteCommunityForumTopic(change: CommunityForumTopicRemoval): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_topic_id: change.topicId,
        p_actor_profile_id: change.actorProfileId,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async deleteCommunityForumReply(change: CommunityForumReplyRemoval): Promise<string> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_community_forum_reply', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_reply_id: change.replyId,
        p_actor_profile_id: change.actorProfileId,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
    const topicId: unknown = await response.json()
    if (typeof topicId !== 'string') {
      throw new Error('Supabase forum reply deletion returned an invalid topic identifier.')
    }
    return topicId
  }

  async getActivityFeedRows(
    userId: string,
    limit: number,
    cursor: ActivityFeedCursor | null
  ): Promise<ActivityFeedRow[]> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_activity_feed_page', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_limit: limit,
        p_cursor_updated_at_ms: cursor?.updatedAt ?? null,
        p_cursor_id: cursor?.id ?? null
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.some(row =>
      typeof row !== 'object' || row === null ||
      typeof (row as Record<string, unknown>).id !== 'string' ||
      typeof (row as Record<string, unknown>).type !== 'string' ||
      !Number.isFinite(Number((row as Record<string, unknown>).updated_at_ms)) ||
      typeof (row as Record<string, unknown>).profile !== 'object' ||
      (row as Record<string, unknown>).profile === null
    )) {
      throw new Error('Supabase relational activity feed returned an invalid page.')
    }

    return rows as ActivityFeedRow[]
  }

  async update<T>(
    collection: string,
    updater: (records: T[]) => T[]
  ): Promise<T[]> {
    let updated: T[] | undefined
    await this.transaction<T[]>([collection], collections => {
      const current = collections[collection] as T[]
      updated = updater(current)
      if (!Array.isArray(updated)) {
        throw new Error('Collection updater must return an array.')
      }
      return {
        records: { ...collections, [collection]: updated },
        result: updated
      }
    })
    return updated!
  }

  async transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => { records: CollectionRecordMap; result: T }
  ): Promise<T> {
    const names = this.validateTransactionCollections(collections)

    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const snapshots = await this.readSnapshots(names)
      const current: CollectionRecordMap = {}
      for (const name of names) {
        current[name] = structuredClone(snapshots.get(name)!.records)
      }

      const outcome = updater(current)
      if (!outcome || typeof outcome !== 'object' || !outcome.records || typeof outcome.records !== 'object') {
        throw new Error('Collection transaction must return records and a result.')
      }

      const changes = names.flatMap(name => {
        const records = outcome.records[name]
        if (!Array.isArray(records)) {
          throw new Error('Collection transaction must return an array for "' + name + '".')
        }
        if (records === current[name]) return []
        if (!(WRITE_COLLECTIONS as readonly string[]).includes(name)) {
          throw new Error('Collection "' + name + '" is read-only.')
        }
        return [{
          collection: name,
          expected_revision: snapshots.get(name)!.revision,
          records
        }]
      })

      if (changes.length === 0) return outcome.result

      const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_commit_relational', {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_changes: changes })
      })

      if (response.status === 409) {
        await this.backoff(attempt)
        continue
      }
      await this.assertSuccess(response)

      const result = await response.json() as { committed?: unknown }
      if (result?.committed === true) return outcome.result
      if (result?.committed === false) {
        await this.backoff(attempt)
        continue
      }
      throw new Error('Supabase relational transaction returned an invalid commit result.')
    }

    throw new Error(
      'Concurrent updates prevented relational transaction (' + names.join(', ') +
      ') from being saved after ' + MAX_UPDATE_ATTEMPTS + ' attempts.'
    )
  }

  private async readSnapshots(
    collections: readonly string[]
  ): Promise<Map<string, CollectionSnapshot>> {
    const names = [...collections]
    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const before = await this.readRevisions(names)
      const rows = await Promise.all(names.map(name => this.readCollection(name)))
      const after = await this.readRevisions(names)

      if (names.some(name => before.get(name) !== after.get(name))) {
        await this.backoff(attempt)
        continue
      }

      return new Map(names.map((name, index) => [
        name,
        { records: rows[index], revision: after.get(name) ?? 0 }
      ]))
    }

    throw new Error(
      'A consistent relational snapshot could not be read for (' + names.join(', ') +
      ') after ' + MAX_UPDATE_ATTEMPTS + ' attempts.'
    )
  }

  private async readRevisions(collections: readonly string[]): Promise<Map<string, number>> {
    if (collections.length === 0) return new Map()
    const url = new URL(this.baseUrl + '/rest/v1/nexus_collection_versions')
    url.searchParams.set('select', 'collection,revision')
    url.searchParams.set(
      'collection',
      'in.(' + collections.filter(name => name !== 'feed_activities').join(',') + ')'
    )
    url.searchParams.set('limit', String(collections.length))

    const names = collections.filter(name => name !== 'feed_activities')
    if (names.length === 0) return new Map(collections.map(name => [name, 0]))

    const response = await fetch(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows = await response.json() as DatabaseRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned an invalid relational version snapshot.')
    }

    const revisions = new Map<string, number>(collections.map(name => [name, 0]))
    for (const row of rows) {
      if (typeof row.collection !== 'string' || !names.includes(row.collection)) {
        throw new Error('Supabase returned an unknown relational collection version.')
      }
      const revision = Number(row.revision)
      if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new Error('Supabase returned an invalid relational collection revision.')
      }
      revisions.set(row.collection, revision)
    }
    return revisions
  }

  private async readCollection(collection: string): Promise<unknown[]> {
    this.assertReadableCollection(collection)

    switch (collection) {
      case 'accounts': {
        const [accounts, memberships, preferences] = await Promise.all([
          this.selectRows('accounts'),
          this.selectRows('account_profiles'),
          this.selectRows('account_preferences')
        ])
        return accounts.map(row => {
          const preference = preferences.find(item => item.account_id === row.id)
          return {
            id: this.string(row.id),
            email: this.string(row.email),
            password: {
              hash: this.string(row.password_hash),
              salt: this.string(row.password_salt)
            },
            profiles: memberships
              .filter(item => item.account_id === row.id)
              .sort((a, b) => this.number(a.position) - this.number(b.position))
              .map(item => this.string(item.profile_id)),
            currentProfile: this.nullableString(row.current_profile_id),
            ...(preference ? {
              preferences: {
                language: this.string(preference.language),
                theme: this.string(preference.theme)
              }
            } : {})
          }
        })
      }
      case 'profiles': {
        const rows = await this.selectRows('profiles')
        return rows.map(row => ({
          id: this.string(row.id),
          name: this.string(row.name),
          url: this.string(row.url),
          picture: this.string(row.picture),
          about: this.string(row.about),
          type: this.string(row.type),
          createdAt: this.number(row.created_at_ms),
          lastActivity: this.number(row.last_activity_ms)
        }))
      }
      case 'communities': {
        const rows = await this.selectRows('communities')
        return rows.map(row => ({
          id: this.string(row.id),
          name: this.string(row.name),
          url: this.string(row.url),
          picture: this.string(row.picture),
          about: this.string(row.about),
          type: this.string(row.type),
          privacy: this.string(row.privacy),
          createdAt: this.number(row.created_at_ms),
          lastActivity: this.number(row.last_activity_ms)
        }))
      }
      case 'relationships': {
        const rows = await this.selectRows('relationships')
        return rows.map(row => ({
          profiles: [this.string(row.profile_id), this.string(row.related_profile_id)],
          type: this.string(row.type),
          requestedBy: this.nullableString(row.requested_by),
          blockedBy: this.nullableString(row.blocked_by),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      case 'community_relationships': {
        const rows = await this.selectRows('community_relationships')
        return rows.map(row => ({
          profiles: [this.string(row.profile_id), this.string(row.community_id)],
          type: this.string(row.type),
          requestedBy: this.nullableString(row.requested_by),
          blockedBy: this.nullableString(row.blocked_by),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      case 'profile_posts': {
        const rows = await this.selectRows('profile_posts')
        return rows.map(row => ({
          id: this.string(row.id),
          profileId: this.string(row.profile_id),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms)
        }))
      }
      case 'profile_settings': {
        const [settings, preferences] = await Promise.all([
          this.selectRows('profile_settings'),
          this.selectRows('profile_activity_preferences')
        ])
        return settings.map(row => {
          const profilePreferences = preferences.filter(item => item.profile_id === row.profile_id)
          return {
            profileId: this.string(row.profile_id),
            messageAudience: this.string(row.message_audience),
            publishActivityTypes: profilePreferences
              .filter(item => item.publish_activity === true)
              .map(item => this.string(item.activity_type)),
            showFriendActivityTypes: profilePreferences
              .filter(item => item.show_friend_activity === true)
              .map(item => this.string(item.activity_type))
          }
        })
      }
      case 'profile_messages': {
        const rows = await this.selectRows('profile_messages')
        return rows.map(row => ({
          id: this.string(row.id),
          fromProfileId: this.string(row.from_profile_id),
          toProfileId: this.string(row.to_profile_id),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms),
          isFavorite: row.is_favorite === true
        }))
      }
      case 'community_forum_topics': {
        const rows = await this.selectRows('community_forum_topics')
        return rows.map(row => ({
          id: this.string(row.id),
          communityId: this.string(row.community_id),
          profileId: this.string(row.profile_id),
          title: this.string(row.title),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms),
          updatedAt: this.number(row.updated_at_ms),
          isPinned: row.is_pinned === true,
          isLocked: row.is_locked === true
        }))
      }
      case 'community_forum_replies': {
        const rows = await this.selectRows('community_forum_replies')
        return rows.map(row => ({
          id: this.string(row.id),
          topicId: this.string(row.topic_id),
          communityId: this.string(row.community_id),
          profileId: this.string(row.profile_id),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      case 'refresh_tokens': {
        const rows = await this.selectRows('refresh_tokens')
        return rows.map(row => ({
          id: this.string(row.id),
          userId: this.string(row.user_id),
          tokenHash: this.string(row.token_hash),
          expiresAt: this.number(row.expires_at_ms)
        }))
      }
      case 'media_files': {
        const rows = await this.selectRows('media_files')
        return rows.map(row => ({
          id: this.string(row.id),
          ownerUserId: this.string(row.owner_user_id),
          purpose: this.string(row.purpose),
          bucket: this.string(row.bucket),
          path: this.string(row.path),
          contentType: this.string(row.content_type),
          expectedSize: this.number(row.expected_size),
          size: this.nullableNumber(row.size),
          status: this.string(row.status),
          deletingAt: this.nullableNumber(row.deleting_at_ms),
          deleteAfter: this.nullableNumber(row.delete_after_ms),
          createdAt: this.number(row.created_at_ms),
          completedAt: this.nullableNumber(row.completed_at_ms),
          expiresAt: this.nullableNumber(row.expires_at_ms),
          resourceType: this.nullableString(row.resource_type),
          resourceId: this.nullableString(row.resource_id),
          messageFromProfileId: this.nullableString(row.message_from_profile_id),
          messageToProfileId: this.nullableString(row.message_to_profile_id)
        }))
      }
      case 'feed_activities': {
        const rows = await this.selectRows('feed_activities')
        return rows.map(row => ({
          id: this.string(row.id),
          type: this.string(row.type),
          profileId: this.string(row.actor_profile_id),
          friendId: this.nullableString(row.target_profile_id),
          communityId: this.nullableString(row.community_id),
          postId: this.nullableString(row.profile_post_id),
          role: this.nullableString(row.role),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      default:
        throw new Error('Unsupported relational collection: ' + collection)
    }
  }

  private async readAccounts(rows: DatabaseRow[]): Promise<unknown[]> {
    if (rows.length === 0) return []
    const accountIds = rows.map(row => this.string(row.id))
    const [memberships, preferences] = await Promise.all([
      this.selectRowsByValues('account_profiles', 'account_id', accountIds),
      this.selectRowsByValues('account_preferences', 'account_id', accountIds)
    ])

    return rows.map(row => {
      const preference = preferences.find(item => item.account_id === row.id)
      return {
        id: this.string(row.id),
        email: this.string(row.email),
        password: {
          hash: this.string(row.password_hash),
          salt: this.string(row.password_salt)
        },
        profiles: memberships
          .filter(item => item.account_id === row.id)
          .sort((a, b) => this.number(a.position) - this.number(b.position))
          .map(item => this.string(item.profile_id)),
        currentProfile: this.nullableString(row.current_profile_id),
        ...(preference ? {
          preferences: {
            language: this.string(preference.language),
            theme: this.string(preference.theme)
          }
        } : {})
      }
    })
  }

  private async selectRowsByValues(
    table: string,
    column: string,
    values: readonly string[]
  ): Promise<DatabaseRow[]> {
    if (values.length === 0) return []
    const url = new URL(this.baseUrl + '/rest/v1/' + table)
    url.searchParams.set('select', '*')
    url.searchParams.set(
      column,
      'in.(' + values.map(value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + ')'
    )
    url.searchParams.set('limit', String(Math.max(values.length * 10, PAGE_SIZE)))
    const response = await fetch(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows = await response.json() as DatabaseRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned an invalid filtered row set for "' + table + '".')
    }
    return rows
  }

  private async selectRowsByField(
    table: string,
    column: string,
    expression: string
  ): Promise<DatabaseRow[]> {
    const url = new URL(this.baseUrl + '/rest/v1/' + table)
    url.searchParams.set('select', '*')
    url.searchParams.set(column, expression)
    url.searchParams.set('limit', '2')
    const response = await fetch(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows = await response.json() as DatabaseRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned an invalid filtered row set for "' + table + '".')
    }
    if (rows.length > 1) {
      throw new Error('Supabase returned more than one account for a unique email.')
    }
    return rows
  }

  private async selectRows(table: string): Promise<DatabaseRow[]> {
    const rows: DatabaseRow[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const url = new URL(this.baseUrl + '/rest/v1/' + table)
      url.searchParams.set('select', '*')
      url.searchParams.set('limit', String(PAGE_SIZE))
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.headers(),
          Range: offset + '-' + (offset + PAGE_SIZE - 1),
          'Range-Unit': 'items'
        }
      })
      await this.assertSuccess(response)
      const page = await response.json() as DatabaseRow[]
      if (!Array.isArray(page)) {
        throw new Error('Supabase returned an invalid row set for "' + table + '".')
      }
      rows.push(...page)
      if (page.length < PAGE_SIZE) return rows
    }
  }

  private mapProfile(row: DatabaseRow): Profile {
    if (
      typeof row.id !== 'string' || typeof row.name !== 'string' ||
      typeof row.url !== 'string' || typeof row.picture !== 'string' ||
      typeof row.about !== 'string' || typeof row.type !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.last_activity_ms))
    ) throw new Error('Supabase relational profile write returned an invalid profile row.')
    return {
      id: row.id, name: row.name, url: row.url, picture: row.picture,
      about: row.about, type: row.type as Profile['type'],
      createdAt: Number(row.created_at_ms), lastActivity: Number(row.last_activity_ms)
    }
  }

  private mapCommunity(row: DatabaseRow): Community {
    if (
      typeof row.id !== 'string' || typeof row.name !== 'string' ||
      typeof row.url !== 'string' || typeof row.picture !== 'string' ||
      typeof row.about !== 'string' || typeof row.type !== 'string' ||
      !['public','private','unlisted'].includes(String(row.privacy)) ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.last_activity_ms))
    ) throw new Error('Supabase relational community write returned an invalid community row.')
    return {
      id: row.id, name: row.name, url: row.url, picture: row.picture,
      about: row.about, type: row.type as Community['type'],
      privacy: row.privacy as Community['privacy'],
      createdAt: Number(row.created_at_ms), lastActivity: Number(row.last_activity_ms)
    }
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.publishableKey,
      'x-nexus-api-secret': this.apiSecret
    }
  }

  private validateTransactionCollections(collections: readonly string[]): string[] {
    const names = [...new Set(collections)]
    if (names.length === 0 || names.length !== collections.length) {
      throw new Error('Relational transaction requires a non-empty list of unique collections.')
    }
    for (const name of names) {
      if (!(WRITE_COLLECTIONS as readonly string[]).includes(name) &&
          name !== 'feed_activities') {
        throw new Error('Unsupported relational collection: ' + name)
      }
    }
    return names.sort()
  }

  private assertReadableCollection(collection: string): void {
    if (!(READ_COLLECTIONS as readonly string[]).includes(collection)) {
      throw new Error('Unsupported relational collection: ' + collection)
    }
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value : String(value ?? '')
  }

  private number(value: unknown): number {
    const result = Number(value)
    if (!Number.isFinite(result)) throw new Error('Supabase returned an invalid numeric field.')
    return result
  }

  private nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  private nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null
    return this.number(value)
  }

  private async backoff(attempt: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.min(5 * (attempt + 1), 40)))
  }

  private async assertSuccess(response: Response): Promise<void> {
    if (response.ok) return
    const details = await response.text()
    throw new Error('Supabase relational request failed (' + response.status + '): ' + details)
  }
}
