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
    const expired = this.data.claimExpiredUploads
      ? await this.data.claimExpiredUploads({
          now,
          claimLeaseMs: DELETE_CLAIM_LEASE_MS,
          safeAge: UPLOAD_DELETE_SAFE_AGE_MS,
          orphanAvatarRetentionMs: ORPHAN_AVATAR_RETENTION_MS,
          limit: STORAGE_DELETE_BATCH_SIZE
        })
      : await this.data.transaction<UploadedFileRecord[]>(
      ['media_files'],
      collections => {
        const currentRecords = collections.media_files as UploadedFileRecord[]
        const candidates = currentRecords.filter(item =>
          (item.status === 'deleting' &&
            (item.deletingAt ?? 0) <= now - DELETE_CLAIM_LEASE_MS &&
            (item.deleteAfter == null || item.deleteAfter <= now)) ||
          (item.purpose === 'editor-image' && item.status === 'ready' && item.expiresAt !== null && item.expiresAt <= now) ||
          (item.status === 'pending' && item.createdAt + UPLOAD_DELETE_SAFE_AGE_MS <= now) ||
          (item.purpose !== 'editor-image' && item.status === 'ready' &&
            !item.resourceType && (item.completedAt ?? item.createdAt) + ORPHAN_AVATAR_RETENTION_MS <= now)
        )
        if (!candidates.length) return { records: collections, result: [] }

        const candidateIds = new Set(candidates.map(item => item.id))
        const claimed = candidates.map(item => ({
          ...item,
          status: 'deleting' as const,
          deletingAt: now,
          deleteAfter: null
        }))
        const claimedById = new Map(claimed.map(item => [item.id, item] as const))
        return {
          records: {
            ...collections,
            media_files: currentRecords.map(item => candidateIds.has(item.id)
              ? claimedById.get(item.id)!
              : item)
          },
          result: claimed
        }
      }
    )
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

          const claimsById = new Map(
            batchClaims.map(item => [item.id, item] as const)
          )
          if (this.data.finishUploadDeletions) {
            deleted += await this.data.finishUploadDeletions(batchClaims.map(item => ({
              id: item.id,
              deletingAt: item.deletingAt ?? 0
            })))
          } else {
            const remaining = await this.data.update<UploadedFileRecord>(
              'media_files',
              currentRecords => currentRecords.filter(item => {
                const claimed = claimsById.get(item.id)
                return !claimed || item.status !== 'deleting' || item.deletingAt !== claimed.deletingAt
              })
            )
            deleted += batchClaims.filter(claimed =>
              !remaining.some(item =>
                item.id === claimed.id && item.status === 'deleting' &&
                item.deletingAt === claimed.deletingAt
              )
            ).length
          }
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
    if (this.data.schedulePreviousAvatarDeletion) {
      await this.data.schedulePreviousAvatarDeletion({
        path, keepId: keepId ?? null, deletingAt,
        safeAge: UPLOAD_DELETE_SAFE_AGE_MS, leaseMs: DELETE_CLAIM_LEASE_MS
      })
      return
    }
    await this.data.transaction<UploadedFileRecord | null>(
      ['media_files'],
      collections => {
        const current = collections.media_files as UploadedFileRecord[]
        const latest = current.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
        const hasActiveClaim = Boolean(
          latest?.status === 'deleting' &&
          (latest.deletingAt ?? 0) > deletingAt - DELETE_CLAIM_LEASE_MS
        )
        if (!latest || latest.id === keepId || hasActiveClaim) {
          return { records: collections, result: null }
        }

        const safeFrom = latest.completedAt ?? latest.createdAt
        const scheduled: UploadedFileRecord = {
          ...latest,
          status: 'deleting',
          deletingAt,
          deleteAfter: Math.max(
            safeFrom + UPLOAD_DELETE_SAFE_AGE_MS,
            deletingAt + DELETE_CLAIM_LEASE_MS
          )
        }
        return {
          records: {
            ...collections,
            media_files: current.map(item => item.id === latest.id ? scheduled : item)
          },
          result: scheduled
        }
      }
    )
  }

  async scheduleUploadDeletion(
    id: string,
    userId: string,
    allowReady = false
  ): Promise<boolean> {
    const scheduledAt = Date.now()
    if (this.data.scheduleUploadDeletion) {
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
    return this.data.transaction<boolean>(
      ['media_files'],
      collections => {
        const current = collections.media_files as UploadedFileRecord[]
        const latest = current.find(item => item.id === id)
        if (!latest || latest.ownerUserId !== userId) {
          return { records: collections, result: true }
        }

        if (latest.status === 'deleting' && latest.deleteAfter != null) {
          return { records: collections, result: true }
        }
        if (latest.status !== 'pending' && !(allowReady && latest.status === 'ready')) {
          return { records: collections, result: false }
        }
        if (latest.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')

        // Signed upload tokens stay usable for two hours, even after a failed
        // transfer. A completed object can also be recreated if it is deleted
        // while its token is still valid, so retain a tombstone for both states.
        const safeFrom = latest.status === 'ready'
          ? (latest.completedAt ?? latest.createdAt)
          : latest.createdAt
        const deleteAfter = Math.max(
          safeFrom + UPLOAD_DELETE_SAFE_AGE_MS,
          scheduledAt + DELETE_CLAIM_LEASE_MS
        )
        const scheduled: UploadedFileRecord = {
          ...latest,
          status: 'deleting',
          deletingAt: scheduledAt,
          deleteAfter
        }
        return {
          records: {
            ...collections,
            media_files: current.map(item => item.id === latest.id ? scheduled : item)
          },
          result: true
        }
      }
    )
  }

  private async deleteRecord(
    id: string,
    userId: string,
    expectedStatus?: 'pending'
  ): Promise<void> {
    const deletingAt = Date.now()
    let deleting: UploadedFileRecord | null
    try {
      deleting = this.data.claimUploadDeletion
        ? await this.data.claimUploadDeletion({ id, userId, deletingAt, expectedStatus })
        : await this.data.transaction<UploadedFileRecord | null>(
      ['media_files'],
      collections => {
        const current = collections.media_files as UploadedFileRecord[]
        const latest = current.find(item => item.id === id && item.ownerUserId === userId)
        const hasActiveClaim = Boolean(
          latest?.status === 'deleting' &&
          (latest.deletingAt ?? 0) > deletingAt - DELETE_CLAIM_LEASE_MS
        )
        if (!latest || hasActiveClaim ||
          (expectedStatus && latest.status !== expectedStatus)) {
          return { records: collections, result: null }
        }
        if (latest.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
        const claimed: UploadedFileRecord = { ...latest, status: 'deleting', deletingAt }
        return {
          records: {
            ...collections,
            media_files: current.map(item => item.id === latest.id ? claimed : item)
          },
          result: claimed
        }
      }
    )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UPLOAD_ALREADY_ATTACHED')) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
      throw error
    }
    if (!deleting) return
    await this.removeObjects(deleting.bucket, [deleting.path])
    if (this.data.finishUploadDeletions) {
      await this.data.finishUploadDeletions([{ id: deleting.id, deletingAt: deleting.deletingAt ?? 0 }])
    } else {
      await this.data.update<UploadedFileRecord>('media_files', current =>
        current.filter(item =>
          item.id !== deleting.id || item.ownerUserId !== userId ||
          item.status !== 'deleting' || item.deletingAt !== deleting.deletingAt
        )
      )
    }
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
