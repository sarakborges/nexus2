export type UploadPurpose =
  | 'profile-avatar'
  | 'community-avatar'
  | 'editor-image'

export type UploadResourceType =
  | 'profile'
  | 'community'
  | 'profile-message'
  | 'profile-post'
  | 'community-forum-topic'
  | 'community-forum-reply'

export type EditorMessageParticipants = {
  fromProfileId: string
  toProfileId: string
}

export type UploadResourceReference = {
  resourceType: UploadResourceType
  resourceId: string
}

export type UploadedFileRecord = {
  id: string
  ownerUserId: string
  purpose: UploadPurpose
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
  resourceType: UploadResourceType | null
  resourceId: string | null
  messageFromProfileId: string | null
  messageToProfileId: string | null
}

export type CreateUploadInput = {
  purpose: UploadPurpose
  contentType: string
  size: number
  targetId?: string
  actorProfileId?: string
}

export type SignedUploadResponse = {
  url?: string
}
