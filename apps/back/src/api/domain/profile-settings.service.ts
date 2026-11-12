import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type { ProfileSettings } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  messageAudience: 'everyone',
  publishActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ],
  showFriendActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ]
}

@Injectable()
export class ProfileSettingsService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository
  ) {}

  async getSettings(userId: string, profileId: string): Promise<ProfileSettings> {
    try {
      return this.normalize(await this.data.getProfileSettings(userId, profileId))
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async updateSettings(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings> {
    try {
      return this.normalize(await this.data.updateProfileSettings(userId, profileId, patch))
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  private normalize(value?: Partial<ProfileSettings>): ProfileSettings {
    const allowed = new Set(DEFAULT_PROFILE_SETTINGS.publishActivityTypes)
    const normalizeTypes = (items?: string[]) => Array.isArray(items)
      ? items.filter((item): item is ProfileSettings['publishActivityTypes'][number] =>
          allowed.has(item as ProfileSettings['publishActivityTypes'][number])
        )
      : [...DEFAULT_PROFILE_SETTINGS.publishActivityTypes]

    return {
      messageAudience: value?.messageAudience === 'friends' ? 'friends' : 'everyone',
      publishActivityTypes: normalizeTypes(value?.publishActivityTypes),
      showFriendActivityTypes: normalizeTypes(value?.showFriendActivityTypes)
    }
  }

  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ACCOUNT_NOT_FOUND')) {
      throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    }
    if (message.includes('PROFILE_NOT_FOUND')) {
      throw new NotFoundException('PROFILE_NOT_FOUND')
    }
    if (message.includes('PROFILE_NOT_OWNED')) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    throw error
  }
}
