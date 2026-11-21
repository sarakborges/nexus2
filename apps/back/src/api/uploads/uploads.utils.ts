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

export type ImageDimensions = {
  width: number
  height: number
}

function readPngDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) return null

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  }
}

function readGifDimensions(bytes: Buffer): ImageDimensions | null {
  const signature = bytes.subarray(0, 6).toString('ascii')
  if (
    bytes.length < 10 ||
    (signature !== 'GIF87a' && signature !== 'GIF89a')
  ) return null

  return {
    width: bytes.readUInt16LE(6),
    height: bytes.readUInt16LE(8)
  }
}

function readWebpDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 20 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) return null

  const chunkType = bytes.toString('ascii', 12, 16)
  const chunkSize = bytes.readUInt32LE(16)
  if (chunkSize < 5) return null

  if (chunkType === 'VP8X') {
    if (chunkSize < 10 || bytes.length < 30) return null
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    }
  }

  if (chunkType === 'VP8 ') {
    if (
      chunkSize < 10 ||
      bytes.length < 30 ||
      bytes[23] !== 0x9d ||
      bytes[24] !== 0x01 ||
      bytes[25] !== 0x2a
    ) return null

    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    }
  }

  if (chunkType === 'VP8L') {
    if (chunkSize < 5 || bytes.length < 25 || bytes[20] !== 0x2f) return null
    const b1 = bytes[21]
    const b2 = bytes[22]
    const b3 = bytes[23]
    const b4 = bytes[24]
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10))
    }
  }

  return null
}

function readJpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) return null

  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
    if (offset >= bytes.length) return null

    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) return null
    if (marker === 0x00) return null
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
    if (offset + 2 > bytes.length) return null

    const segmentLength = bytes.readUInt16BE(offset)
    if (segmentLength < 2) return null
    const segmentEnd = offset + segmentLength
    if (segmentEnd > bytes.length) return null

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)

    if (isStartOfFrame) {
      if (segmentLength < 8) return null
      const dataOffset = offset + 2
      return {
        height: bytes.readUInt16BE(dataOffset + 1),
        width: bytes.readUInt16BE(dataOffset + 3)
      }
    }

    offset = segmentEnd
  }

  return null
}

function readAvifDimensions(bytes: Buffer): ImageDimensions | null {
  const containerTypes = new Set(['meta', 'iprp', 'ipco'])

  const findInBoxes = (
    start: number,
    end: number,
    depth: number
  ): ImageDimensions | null => {
    if (depth > 6) return null
    let offset = start

    while (offset + 8 <= end) {
      const size32 = bytes.readUInt32BE(offset)
      const type = bytes.toString('ascii', offset + 4, offset + 8)
      let headerSize = 8
      let boxSize: number

      if (size32 === 1) {
        if (offset + 16 > end) return null
        const extendedSize = bytes.readBigUInt64BE(offset + 8)
        if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null
        boxSize = Number(extendedSize)
        headerSize = 16
      } else if (size32 === 0) {
        boxSize = end - offset
      } else {
        boxSize = size32
      }

      if (boxSize < headerSize) return null
      const declaredEnd = offset + boxSize
      const boxEnd = Math.min(end, declaredEnd)
      const dataStart = offset + headerSize

      if (type === 'ispe') {
        if (boxSize >= headerSize + 12 && dataStart + 12 <= boxEnd) {
          return {
            width: bytes.readUInt32BE(dataStart + 4),
            height: bytes.readUInt32BE(dataStart + 8)
          }
        }
      } else if (containerTypes.has(type)) {
        const childrenStart = dataStart + (type === 'meta' ? 4 : 0)
        if (childrenStart <= boxEnd) {
          const dimensions = findInBoxes(childrenStart, boxEnd, depth + 1)
          if (dimensions) return dimensions
        }
      }

      if (declaredEnd > end || boxEnd <= offset) break
      offset = boxEnd
    }

    return null
  }

  return findInBoxes(0, bytes.length, 0)
}

export function getImageDimensions(
  bytes: Buffer,
  contentType: string
): ImageDimensions | null {
  switch (contentType) {
    case 'image/jpeg':
      return readJpegDimensions(bytes)
    case 'image/png':
      return readPngDimensions(bytes)
    case 'image/gif':
      return readGifDimensions(bytes)
    case 'image/webp':
      return readWebpDimensions(bytes)
    case 'image/avif':
      return readAvifDimensions(bytes)
    default:
      return null
  }
}

export function isImageDimensionsWithinLimits(
  dimensions: ImageDimensions | null
): dimensions is ImageDimensions {
  return Boolean(
    dimensions &&
    Number.isSafeInteger(dimensions.width) &&
    Number.isSafeInteger(dimensions.height) &&
    dimensions.width > 0 &&
    dimensions.height > 0 &&
    dimensions.width <= 8192 &&
    dimensions.height <= 8192 &&
    dimensions.width * dimensions.height <= 16 * 1024 * 1024
  )
}
