import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'node:crypto'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import {
  AVATAR_BUCKET,
  DELETE_CLAIM_LEASE_MS,
  EDITOR_BUCKET,
  ORPHAN_AVATAR_RETENTION_MS,
  STORAGE_DELETE_BATCH_SIZE,
  UPLOAD_DELETE_SAFE_AGE_MS
} from './uploads.constants'
import { UploadsStorageService } from './uploads.storage.service'
import type { UploadedFileRecord } from './uploads.types'

@Injectable()
export class UploadsCleanupService {
  private readonly cronSecret: string

  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    config: ConfigService,
    private readonly storage: UploadsStorageService
  ) {
    this.cronSecret = config.get<string>('CRON_SECRET') ?? ''
  }

  async deleteUpload(userId: string, id: string): Promise<void> {
    if (await this.scheduleUploadDeletion(id, userId, true)) return
    await this.deleteRecord(id, userId)
  }

  async cleanupExpired(suppliedSecret: string | undefined): Promise<{ deleted: number }> {
    if (!this.secretsMatch(this.cronSecret, suppliedSecret)) {
      throw new ForbiddenException('CRON_SECRET_INVALID')
    }
    this.storage.assertConfigured()

    const now = Date.now()
    const expired = await this.data.claimExpiredUploads({
      now,
      claimLeaseMs: DELETE_CLAIM_LEASE_MS,
      safeAge: UPLOAD_DELETE_SAFE_AGE_MS,
      orphanAvatarRetentionMs: ORPHAN_AVATAR_RETENTION_MS,
      limit: STORAGE_DELETE_BATCH_SIZE
    })
    if (!expired.length) return { deleted: 0 }

    let deleted = 0
    let hasFailures = false

    for (const bucket of [AVATAR_BUCKET, EDITOR_BUCKET]) {
      const bucketClaims = expired.filter(item => item.bucket === bucket)
      if (!bucketClaims.length) continue

      for (
        let offset = 0;
        offset < bucketClaims.length;
        offset += STORAGE_DELETE_BATCH_SIZE
      ) {
        const batchClaims = bucketClaims.slice(
          offset,
          offset + STORAGE_DELETE_BATCH_SIZE
        )
        try {
          await this.removeObjects(
            bucket,
            batchClaims.map(item => item.path)
          )

          deleted += await this.data.finishUploadDeletions(batchClaims.map(item => ({
            id: item.id,
            deletingAt: item.deletingAt ?? 0
          })))
        } catch {
          // Keep failed claims in "deleting". A later cleanup or delete retry
          // can reclaim them after the lease expires. Continue with later batches.
          hasFailures = true
        }
      }
    }

    if (hasFailures) {
      throw new ServiceUnavailableException('UPLOAD_CLEANUP_PARTIAL_FAILURE')
    }

    return { deleted }
  }

  async deletePreviousAvatar(previousUrl: string, keepId?: string): Promise<void> {
    const path = this.storage.getAvatarPath(previousUrl)
    if (!path) return
    const deletingAt = Date.now()
    await this.data.schedulePreviousAvatarDeletion({
      path, keepId: keepId ?? null, deletingAt,
      safeAge: UPLOAD_DELETE_SAFE_AGE_MS, leaseMs: DELETE_CLAIM_LEASE_MS
    })
  }

  async scheduleUploadDeletion(
    id: string,
    userId: string,
    allowReady = false
  ): Promise<boolean> {
    const scheduledAt = Date.now()
    try {
      return await this.data.scheduleUploadDeletion({
        id, userId, scheduledAt, allowReady,
        safeAge: UPLOAD_DELETE_SAFE_AGE_MS, leaseMs: DELETE_CLAIM_LEASE_MS
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UPLOAD_ALREADY_ATTACHED')) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
      throw error
    }
  }

  private async deleteRecord(
    id: string,
    userId: string,
    expectedStatus?: 'pending'
  ): Promise<void> {
    const deletingAt = Date.now()
    let deleting: UploadedFileRecord | null
    try {
      deleting = await this.data.claimUploadDeletion({ id, userId, deletingAt, expectedStatus })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UPLOAD_ALREADY_ATTACHED')) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
      throw error
    }
    if (!deleting) return
    await this.removeObjects(deleting.bucket, [deleting.path])
    await this.data.finishUploadDeletions([{ id: deleting.id, deletingAt: deleting.deletingAt ?? 0 }])
  }

  private async removeObjects(bucket: string, paths: string[]): Promise<void> {
    const response = await this.storage.request('/object/' + bucket, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: paths })
    })
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_DELETE_FAILED')
  }

  private secretsMatch(expected: string, actual?: string): boolean {
    if (!expected || !actual) return false
    const left = Buffer.from(expected)
    const right = Buffer.from(actual)
    return left.length === right.length && timingSafeEqual(left, right)
  }
}
