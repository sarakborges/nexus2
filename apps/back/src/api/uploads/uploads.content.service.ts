import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { UploadsStorageService } from './uploads.storage.service'
import { detectMime } from './uploads.utils'
import { AVATAR_MAX_SIZE, EDITOR_MAX_SIZE } from './uploads.constants'
import type { CommunityAvatarReadRequest } from '../../storage/repository.types'
import type { UploadedFileRecord } from './uploads.types'

@Injectable()
export class UploadsContentService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly storage: UploadsStorageService
  ) {}

  async getEditorImage(userId: string | null, id: string): Promise<{ body: Buffer; contentType: string }> {
    this.storage.assertConfigured()
    let record: UploadedFileRecord
    try {
      record = await this.data.getEditorImageRecord({ userId, id, now: Date.now() })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UPLOAD_ACCESS_DENIED')) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
      if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      if (message.includes('UPLOAD_NOT_FOUND')) throw new NotFoundException('UPLOAD_NOT_FOUND')
      throw error
    }
    return this.downloadManagedImage(record)
  }

  async getCommunityAvatar(userId: string | null, id: string): Promise<{ body: Buffer; contentType: string }> {
    this.storage.assertConfigured()
    let record: UploadedFileRecord
    try {
      const request: CommunityAvatarReadRequest = { userId, id }
      record = await this.data.getCommunityAvatarRecord(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UPLOAD_ACCESS_DENIED')) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
      if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      if (message.includes('UPLOAD_NOT_FOUND')) throw new NotFoundException('UPLOAD_NOT_FOUND')
      throw error
    }
    return this.downloadManagedImage(record)
  }

  private async downloadManagedImage(record: UploadedFileRecord): Promise<{ body: Buffer; contentType: string }> {
    const response = await this.storage.request(
      '/object/' + record.bucket + '/' + this.storage.encodePath(record.path),
      { method: 'GET' }
    )
    if (response.status === 404) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    const maxSize = record.purpose === 'editor-image'
      ? EDITOR_MAX_SIZE
      : AVATAR_MAX_SIZE
    if (
      !Number.isSafeInteger(record.size) ||
      record.size === null ||
      record.size < 1 ||
      record.size > maxSize
    ) {
      await response.body?.cancel().catch(() => undefined)
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }

    const body = await this.readBoundedBody(response, record.size)
    if (body.length !== record.size || detectMime(body) !== record.contentType) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    return { body, contentType: record.contentType }
  }

  private async readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
    const reader = response.body?.getReader()
    if (!reader) throw new NotFoundException('UPLOAD_NOT_FOUND')

    const chunks: Buffer[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maxBytes) {
          await reader.cancel().catch(() => undefined)
          throw new NotFoundException('UPLOAD_NOT_FOUND')
        }
        chunks.push(Buffer.from(value))
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error
      throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    } finally {
      reader.releaseLock()
    }
    return Buffer.concat(chunks, size)
  }
}
