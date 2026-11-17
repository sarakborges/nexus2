import type { CommunityAvatarWrite, EditorImageReadRequest, MediaFileRecord, MediaUploadCleanupRequest, MediaUploadCompletion, MediaUploadCreateWrite, MediaUploadDeletionClaim, MediaUploadDeletionRequest, MediaUploadDeletionSchedule, PreviousAvatarDeletionSchedule, ProfileAvatarWrite } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { DatabaseRow } from '../supabase-repository.client'
import type { MediaRepository } from '../contracts/media.repository.interface'

export class SupabaseMediaRepository extends SupabaseRepositoryClient implements MediaRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
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
}
