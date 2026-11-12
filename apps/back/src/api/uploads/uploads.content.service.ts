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
    return this.downloadEditorImage(record)
  }

  private async downloadEditorImage(record: UploadedFileRecord): Promise<{ body: Buffer; contentType: string }> {
    const response = await this.storage.request(
      '/object/' + record.bucket + '/' + this.storage.encodePath(record.path),
      { method: 'GET' }
    )
    if (response.status === 404) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length !== record.size || detectMime(body) !== record.contentType) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    return { body, contentType: record.contentType }
  }
}
