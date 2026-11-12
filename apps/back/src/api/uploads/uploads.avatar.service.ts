import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { AVATAR_BUCKET } from './uploads.constants'
import { UploadsStorageService } from './uploads.storage.service'
import { UploadsCleanupService } from './uploads.cleanup.service'
import { isWithinAvatarDraftRetention } from './uploads.utils'
import type { UploadedFileRecord } from './uploads.types'

@Injectable()
export class UploadsAvatarService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly storage: UploadsStorageService,
    private readonly cleanup: UploadsCleanupService
  ) {}

  attachAvatarUrlToRecords(
    records: UploadedFileRecord[],
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    const path = this.storage.getAvatarPath(url)
    if (!path) return records
    const record = records.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
    if (!record || record.ownerUserId !== userId || record.purpose !== purpose ||
      record.status !== 'ready' || record.resourceType ||
      !isWithinAvatarDraftRetention(record)) {
      throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    }
    return records.map(item => item.id === record.id ? { ...item, resourceType, resourceId } : item)
  }

  attachAvatarRecordToRecords(
    records: UploadedFileRecord[],
    userId: string,
    uploadId: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    const record = this.getReadyAvatar(records, userId, uploadId, purpose)
    return records.map(item => item.id === record.id ? { ...item, resourceType, resourceId } : item)
  }

  async setProfileAvatar(userId: string, profileId: string, uploadId: string | null): Promise<{ picture: string }> {
    const path = uploadId
      ? await this.data.getAvatarUploadPath(userId, uploadId, 'profile-avatar')
      : null
    if (uploadId && !path) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    const picture = path ? this.storage.publicAvatarUrl(path) : ''
    let result: { previousPicture: string }
    try {
      result = await this.data.setProfileAvatar({ userId, profileId, uploadId, picture })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
    await this.cleanup.deletePreviousAvatar(result.previousPicture, uploadId ?? undefined)
    return { picture }
  }

  async setCommunityAvatar(
    userId: string,
    communityId: string,
    actorProfileId: string,
    uploadId: string | null
  ): Promise<{ picture: string }> {
    const path = uploadId
      ? await this.data.getAvatarUploadPath(userId, uploadId, 'community-avatar')
      : null
    if (uploadId && !path) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    const picture = path ? this.storage.publicAvatarUrl(path) : ''
    let result: { previousPicture: string }
    try {
      result = await this.data.setCommunityAvatar({
        userId, communityId, actorProfileId, uploadId, picture
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
    await this.cleanup.deletePreviousAvatar(result.previousPicture, uploadId ?? undefined)
    return { picture }
  }

  assertOwnsProfileInRecords(
    userId: string,
    profileId: string,
    accounts: readonly AccountRecord[],
    profiles: readonly { id: string; type?: string }[]
  ): void {
    const account = accounts.find(item => item.id === userId)
    if (!account || !account.profiles.includes(profileId)) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    if (!account.currentProfile) return
    const currentProfile = profiles.find(profile => profile.id === account.currentProfile)
    const targetProfile = profiles.find(profile => profile.id === profileId)
    if (
      currentProfile?.type &&
      targetProfile?.type &&
      currentProfile.type !== targetProfile.type
    ) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
  }

  private getReadyAvatar(
    records: UploadedFileRecord[],
    userId: string,
    id: string,
    purpose: 'profile-avatar' | 'community-avatar'
  ): UploadedFileRecord {
    const file = records.find(item =>
      item.id === id &&
      item.ownerUserId === userId &&
      item.purpose === purpose &&
      item.status === 'ready' &&
      !item.resourceType &&
      isWithinAvatarDraftRetention(item)
    )
    if (!file) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    return file
  }
  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('PROFILE_NOT_OWNED') || message.includes('PROFILE_TYPE_MISMATCH') ||
        message.includes('COMMUNITY_STAFF_REQUIRED')) {
      throw new ForbiddenException(
        message.includes('PROFILE_TYPE_MISMATCH') ? 'PROFILE_TYPE_MISMATCH' :
        message.includes('COMMUNITY_STAFF_REQUIRED') ? 'COMMUNITY_STAFF_REQUIRED' : 'PROFILE_NOT_OWNED'
      )
    }
    if (message.includes('PROFILE_NOT_FOUND')) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (message.includes('COMMUNITY_NOT_FOUND')) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (message.includes('INVALID_AVATAR_UPLOAD')) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    throw error
  }


}
