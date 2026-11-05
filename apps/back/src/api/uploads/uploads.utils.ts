import { ORPHAN_AVATAR_RETENTION_MS } from './uploads.constants'
import type { UploadedFileRecord } from './uploads.types'

export function isWithinAvatarDraftRetention(
  record: UploadedFileRecord,
  now = Date.now()
): boolean {
  return (
    (record.completedAt ?? record.createdAt) + ORPHAN_AVATAR_RETENTION_MS >
    now
  )
}
