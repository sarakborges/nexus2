import type { ActivityFeedCursor, AuthenticatedUser, Community, UserPreferences, PaginatedResult, Profile, CommunitiesPageData, CommunityEditPageData, CommunityForumComposerPageData, CommunityForumPageData, CommunityForumReply, CommunityForumTopic, CommunityForumTopicDetail, CommunityForumTopicSummary, CommunityForumTopicPageData, CommunityMember, CommunityMembersPageData, CommunityPageData, CommunityRelationship, ListSort, ProfileDirectoryPageData, ProfileEditPageData, ProfileMessage, ProfileMessagesPageData, ProfilePageData, ProfilePost, ProfileSettings, Relationship, SearchResultItem, SearchScope } from '@nexus/common'
import type {
  DataRepository,
  CollectionRecordMap,
  CollectionTransaction,
  AccountRepositoryRecord,
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
  RefreshTokenWrite,
  CreateAccountWithRefreshTokenWrite,
  MediaFileRecord,
  MediaUploadCreateWrite,
  MediaUploadCompletion,
  MediaUploadCleanupRequest,
  MediaUploadDeletionClaim,
  MediaUploadDeletionSchedule,
  MediaUploadDeletionRequest,
  PreviousAvatarDeletionSchedule,
  EditorImageReadRequest
} from './repository.interface'

type DatabaseRow = Record<string, unknown>
const MAX_FILTERED_ROWS = 1000

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
    throw new Error(
      'Full-table reads are disabled for Supabase relational storage (requested "' + collection + '").'
    )
  }

  async readByIds<T extends { id: string }>(
    collection: string,
    _ids: readonly string[]
  ): Promise<T[]> {
    throw new Error(
      'Generic ID reads are disabled for Supabase relational storage (requested "' + collection + '"). Use a typed ID query.'
    )
  }

  async update<T>(
    collection: string,
    _updater: (records: T[]) => T[]
  ): Promise<T[]> {
    throw new Error(
      'Whole-collection updates are disabled for Supabase relational storage (requested "' + collection + '"). Use a targeted mutation RPC.'
    )
  }

  async transaction<T>(
    collections: readonly string[],
    _updater: (records: CollectionRecordMap) => CollectionTransaction<T>
  ): Promise<T> {
    throw new Error(
      'Generic collection transactions are disabled for Supabase relational storage (requested "' + collections.join(', ') + '"). Use targeted relational RPCs.'
    )
  }

  async getAccountById(id: string): Promise<AccountRepositoryRecord | null> {
    const rows = await this.selectRowsByValues('accounts', 'id', [id])
    const [account] = await this.readAccounts(rows)
    return (account as AccountRepositoryRecord | undefined) ?? null
  }

  async findAccountByEmail(email: string): Promise<AccountRepositoryRecord | null> {
    const rows = await this.selectRowsByField('accounts', 'email', 'eq.' + email)
    const [account] = await this.readAccounts(rows)
    return (account as AccountRepositoryRecord | undefined) ?? null
  }

  async getProfilesByIds(ids: readonly string[]): Promise<Profile[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []
    return (await this.selectRowsByValues('profiles', 'id', uniqueIds)).map(row => ({
      id: this.string(row.id),
      name: this.string(row.name),
      url: this.string(row.url),
      picture: this.string(row.picture),
      about: this.string(row.about),
      type: this.string(row.type) as Profile['type'],
      createdAt: this.number(row.created_at_ms),
      lastActivity: this.number(row.last_activity_ms)
    }))
  }

  async getCommunitiesByIds(ids: readonly string[]): Promise<Community[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []
    return (await this.selectRowsByValues('communities', 'id', uniqueIds)).map(row => ({
      id: this.string(row.id),
      name: this.string(row.name),
      url: this.string(row.url),
      picture: this.string(row.picture),
      about: this.string(row.about),
      type: this.string(row.type) as Community['type'],
      privacy: this.string(row.privacy) as Community['privacy'],
      createdAt: this.number(row.created_at_ms),
      lastActivity: this.number(row.last_activity_ms)
    }))
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



  async createAccountWithRefreshToken(change: CreateAccountWithRefreshTokenWrite): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_account_with_refresh_token', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_account_id: change.accountId,
        p_email: change.email,
        p_password_hash: change.passwordHash,
        p_password_salt: change.passwordSalt,
        p_refresh_token_id: change.refreshToken.id,
        p_refresh_token_hash: change.refreshToken.tokenHash,
        p_refresh_token_expires_at_ms: change.refreshToken.expiresAt,
        p_now_ms: change.now
      })
    })
    await this.assertSuccess(response)
  }

  async updateAccountPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_update_account_preferences', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_language: preferences.language ?? null,
        p_theme: preferences.theme ?? null
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (
      !Array.isArray(rows) || rows.length !== 1 ||
      !['system', 'pt-BR', 'en-US'].includes(String(rows[0]?.language)) ||
      !['system', 'light', 'dark'].includes(String(rows[0]?.theme))
    ) throw new Error('Supabase account preferences write returned an invalid result.')
    return {
      language: rows[0].language as UserPreferences['language'],
      theme: rows[0].theme as UserPreferences['theme']
    }
  }

  async createUpload(change: MediaUploadCreateWrite): Promise<void> {
    const record = change.record
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_upload', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_id: record.id, p_user_id: record.ownerUserId, p_purpose: record.purpose,
        p_bucket: record.bucket, p_path: record.path, p_content_type: record.contentType,
        p_expected_size: record.expectedSize, p_created_at_ms: record.createdAt,
        p_target_id: change.targetId, p_actor_profile_id: change.actorProfileId
      })
    })
    await this.assertSuccess(response)
  }

  async getUploadById(userId: string, id: string): Promise<MediaFileRecord | null> {
    const url = new URL(this.baseUrl + '/rest/v1/media_files')
    url.searchParams.set('select', '*')
    url.searchParams.set('id', 'eq.' + id)
    url.searchParams.set('owner_user_id', 'eq.' + userId)
    url.searchParams.set('limit', '1')
    const response = await fetch(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) throw new Error('Supabase upload lookup returned an invalid result.')
    return rows.length ? this.mapMediaFile(rows[0] as DatabaseRow) : null
  }

  async deletePendingUpload(userId: string, id: string): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_pending_upload', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_id: id })
    })
    await this.assertSuccess(response)
  }

  async completeUpload(change: MediaUploadCompletion): Promise<MediaFileRecord> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_complete_upload', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId, p_id: change.id, p_size: change.size,
        p_completed_at_ms: change.completedAt, p_expires_at_ms: change.expiresAt,
        p_pending_max_age_ms: change.pendingMaxAge
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase upload completion returned an invalid result.')
    }
    return this.mapMediaFile(rows[0] as DatabaseRow)
  }

  async claimExpiredUploads(change: MediaUploadCleanupRequest): Promise<MediaFileRecord[]> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_claim_expired_uploads', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_now_ms: change.now, p_claim_lease_ms: change.claimLeaseMs,
        p_safe_age_ms: change.safeAge, p_orphan_avatar_retention_ms: change.orphanAvatarRetentionMs,
        p_limit: change.limit
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) throw new Error('Supabase upload cleanup claim returned an invalid result.')
    return rows.map(row => this.mapMediaFile(row as DatabaseRow))
  }

  async finishUploadDeletions(claims: readonly MediaUploadDeletionClaim[]): Promise<number> {
    if (!claims.length) return 0
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_finish_upload_deletions', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_claims: claims.map(claim => ({ id: claim.id, deleting_at_ms: claim.deletingAt }))
      })
    })
    await this.assertSuccess(response)
    const count = Number(await response.json())
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('Supabase upload deletion completion returned an invalid count.')
    }
    return count
  }

  async scheduleUploadDeletion(change: MediaUploadDeletionSchedule): Promise<boolean> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_schedule_upload_deletion', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_id: change.id, p_user_id: change.userId, p_scheduled_at_ms: change.scheduledAt,
        p_allow_ready: change.allowReady, p_safe_age_ms: change.safeAge, p_lease_ms: change.leaseMs
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'boolean') throw new Error('Supabase upload deletion schedule returned an invalid result.')
    return result
  }

  async claimUploadDeletion(change: MediaUploadDeletionRequest): Promise<MediaFileRecord | null> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_claim_upload_deletion', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_id: change.id, p_user_id: change.userId, p_deleting_at_ms: change.deletingAt,
        p_expected_status: change.expectedStatus ?? null
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length > 1) {
      throw new Error('Supabase upload deletion claim returned an invalid result.')
    }
    return rows.length ? this.mapMediaFile(rows[0] as DatabaseRow) : null
  }

  async schedulePreviousAvatarDeletion(change: PreviousAvatarDeletionSchedule): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_schedule_previous_avatar_deletion', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_path: change.path, p_keep_id: change.keepId, p_deleting_at_ms: change.deletingAt,
        p_safe_age_ms: change.safeAge, p_lease_ms: change.leaseMs
      })
    })
    await this.assertSuccess(response)
  }

  async getEditorImageRecord(change: EditorImageReadRequest): Promise<MediaFileRecord> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_editor_image', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: change.userId, p_id: change.id, p_now_ms: change.now })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase editor image authorization returned an invalid result.')
    }
    return this.mapMediaFile(rows[0] as DatabaseRow)
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
    url.searchParams.set('limit', String(Math.max(values.length * 10, MAX_FILTERED_ROWS)))
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

  private mediaResourceType(value: unknown): MediaFileRecord['resourceType'] {
    if (value == null) return null
    if (
      value === 'profile' || value === 'community' ||
      value === 'profile-message' || value === 'profile-post' ||
      value === 'community-forum-topic' || value === 'community-forum-reply'
    ) return value
    throw new Error('Supabase returned an unsupported media resource type.')
  }

  private mapMediaFile(row: DatabaseRow): MediaFileRecord {
    if (
      typeof row.id !== 'string' || typeof row.owner_user_id !== 'string' ||
      typeof row.purpose !== 'string' || typeof row.bucket !== 'string' ||
      typeof row.path !== 'string' || typeof row.content_type !== 'string' ||
      !Number.isFinite(Number(row.expected_size)) ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !['pending','ready','deleting'].includes(String(row.status))
    ) throw new Error('Supabase returned an invalid media file row.')
    return {
      id: row.id, ownerUserId: row.owner_user_id,
      purpose: row.purpose as MediaFileRecord['purpose'],
      bucket: row.bucket, path: row.path, contentType: row.content_type,
      expectedSize: Number(row.expected_size),
      size: row.size == null ? null : Number(row.size),
      status: row.status as MediaFileRecord['status'],
      deletingAt: row.deleting_at_ms == null ? null : Number(row.deleting_at_ms),
      deleteAfter: row.delete_after_ms == null ? null : Number(row.delete_after_ms),
      createdAt: Number(row.created_at_ms),
      completedAt: row.completed_at_ms == null ? null : Number(row.completed_at_ms),
      expiresAt: row.expires_at_ms == null ? null : Number(row.expires_at_ms),
      resourceType: this.mediaResourceType(row.resource_type),
      resourceId: typeof row.resource_id === 'string' ? row.resource_id : null,
      messageFromProfileId: typeof row.message_from_profile_id === 'string' ? row.message_from_profile_id : null,
      messageToProfileId: typeof row.message_to_profile_id === 'string' ? row.message_to_profile_id : null
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

  private async assertSuccess(response: Response): Promise<void> {
    if (response.ok) return
    const details = await response.text()
    throw new Error('Supabase relational request failed (' + response.status + '): ' + details)
  }
}
