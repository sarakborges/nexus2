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

export function getTotalSize(
  contentRange: string | null,
  contentLength: string | null,
  bodySize: number
): number {
  const total = contentRange?.split('/').pop()
  const parsedTotal = total ? Number(total) : Number(contentLength)
  return Number.isSafeInteger(parsedTotal) && parsedTotal > 0 ? parsedTotal : bodySize
}

export function detectMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  const prefix = bytes.subarray(0, 6).toString('ascii')
  if (prefix === 'GIF87a' || prefix === 'GIF89a') return 'image/gif'
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (bytes.length >= 12 && bytes.subarray(4, 12).toString('ascii').startsWith('ftypavif')) return 'image/avif'
  return null
}
