import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AVATAR_BUCKET } from './uploads.constants'

@Injectable()
export class UploadsStorageService {
  private readonly supabaseUrl: string
  private readonly storageSecret: string

  constructor(config: ConfigService) {
    this.supabaseUrl = (config.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '')
    this.storageSecret = config.get<string>('SUPABASE_STORAGE_SECRET_KEY') ?? ''
  }

  assertConfigured(): void {
    if (!this.supabaseUrl || !this.storageSecret) {
      throw new ServiceUnavailableException('UPLOAD_STORAGE_NOT_CONFIGURED')
    }
  }

  async request(path: string, init: RequestInit): Promise<Response> {
    this.assertConfigured()
    const headers = new Headers(init.headers)
    headers.set('apikey', this.storageSecret)
    headers.delete('authorization')
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

    try {
      return await fetch(this.supabaseUrl + '/storage/v1' + path, { ...init, headers })
    } catch {
      throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    }
  }

  async readJson<T>(response: Response): Promise<T> {
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    return await response.json() as T
  }

  resolveUploadUrl(url: string): string {
    return url.startsWith('http') ? url : this.supabaseUrl + '/storage/v1' + url
  }

  publicAvatarUrl(path: string): string {
    return this.supabaseUrl + '/storage/v1/object/public/' +
      AVATAR_BUCKET + '/' + this.encodePath(path)
  }

  getAvatarPath(url: string): string | null {
    if (!url) return null
    const prefix = this.supabaseUrl + '/storage/v1/object/public/' + AVATAR_BUCKET + '/'
    if (!url.startsWith(prefix)) return null
    try {
      return url.slice(prefix.length).split('/').map(segment => decodeURIComponent(segment)).join('/')
    } catch {
      throw new BadRequestException('INVALID_AVATAR_URL')
    }
  }

  getTotalSize(contentRange: string | null, contentLength: string | null, bodySize: number): number {
    const total = contentRange?.split('/').pop()
    const parsedTotal = total ? Number(total) : Number(contentLength)
    return Number.isSafeInteger(parsedTotal) && parsedTotal > 0 ? parsedTotal : bodySize
  }

  detectMime(bytes: Buffer): string | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
    const prefix = bytes.subarray(0, 6).toString('ascii')
    if (prefix === 'GIF87a' || prefix === 'GIF89a') return 'image/gif'
    if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
    if (bytes.length >= 12 && bytes.subarray(4, 12).toString('ascii').startsWith('ftypavif')) return 'image/avif'
    return null
  }

  encodePath(path: string): string {
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  }
}
