export const AVATAR_BUCKET = 'nexus-avatars'
export const EDITOR_BUCKET = 'nexus-editor-images'

export const AVATAR_MAX_SIZE = 5 * 1024 * 1024
export const EDITOR_MAX_SIZE = 10 * 1024 * 1024

export const PENDING_MAX_AGE = 2 * 60 * 60 * 1000
export const SIGNED_UPLOAD_DELETE_GRACE_MS = 60 * 60 * 1000
export const UPLOAD_DELETE_SAFE_AGE_MS =
  PENDING_MAX_AGE + SIGNED_UPLOAD_DELETE_GRACE_MS
export const DELETE_CLAIM_LEASE_MS = 5 * 60 * 1000
export const STORAGE_DELETE_BATCH_SIZE = 1000
export const EDITOR_RETENTION_MS = 24 * 60 * 60 * 1000
export const ORPHAN_AVATAR_RETENTION_MS = 24 * 60 * 60 * 1000

export const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
}

export const UPLOAD_REFERENCE =
  /<img\b[^>]*\bsrc=(["'])\/api\/uploads\/([0-9a-f-]{36})\/content\1/gi
