import type { CommunityAvatarWrite, EditorImageReadRequest, MediaFileRecord, MediaUploadCleanupRequest, MediaUploadCompletion, MediaUploadCreateWrite, MediaUploadDeletionClaim, MediaUploadDeletionRequest, MediaUploadDeletionSchedule, PreviousAvatarDeletionSchedule, ProfileAvatarWrite } from '../repository.types'

export interface MediaRepository {
  createUpload(change: MediaUploadCreateWrite): Promise<void>
  getUploadById(userId: string, id: string): Promise<MediaFileRecord | null>
  deletePendingUpload(userId: string, id: string): Promise<void>
  completeUpload(change: MediaUploadCompletion): Promise<MediaFileRecord>
  claimExpiredUploads(change: MediaUploadCleanupRequest): Promise<MediaFileRecord[]>
  finishUploadDeletions(claims: readonly MediaUploadDeletionClaim[]): Promise<number>
  scheduleUploadDeletion(change: MediaUploadDeletionSchedule): Promise<boolean>
  claimUploadDeletion(change: MediaUploadDeletionRequest): Promise<MediaFileRecord | null>
  schedulePreviousAvatarDeletion(change: PreviousAvatarDeletionSchedule): Promise<void>
  getEditorImageRecord(change: EditorImageReadRequest): Promise<MediaFileRecord>
  getAvatarUploadPath(
    userId: string,
    uploadId: string,
    purpose: 'profile-avatar' | 'community-avatar'
  ): Promise<string | null>
  setProfileAvatar(change: ProfileAvatarWrite): Promise<{ previousPicture: string }>
  setCommunityAvatar(change: CommunityAvatarWrite): Promise<{ previousPicture: string }>
}
