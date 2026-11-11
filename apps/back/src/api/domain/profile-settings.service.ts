import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type { ProfileSettings } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'

type ProfileSettingsRecord = ProfileSettings & { profileId: string }

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

  getSettings(userId: string, profileId: string): Promise<ProfileSettings> {
    if (this.data.getProfileSettings) {
      return this.data.getProfileSettings(userId, profileId).catch(error => {
        this.throwRelationalWriteError(error)
      })
    }

    return this.data.transaction<ProfileSettings>(
      ['accounts', 'profiles', 'profile_settings'],
      collections => {
        this.assertOwnsProfile(
          userId,
          profileId,
          collections.accounts as AccountRecord[],
          collections.profiles as Array<{ id: string }>
        )
        const record = (collections.profile_settings as ProfileSettingsRecord[] | undefined)
          ?.find(item => item.profileId === profileId)

        return { records: collections, result: this.normalize(record) }
      }
    )
  }

  updateSettings(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings> {
    if (this.data.updateProfileSettings) {
      return this.data.updateProfileSettings(userId, profileId, patch).catch(error => {
        this.throwRelationalWriteError(error)
      })
    }

    return this.data.transaction<ProfileSettings>(
      ['accounts', 'profiles', 'profile_settings'],
      collections => {
        this.assertOwnsProfile(
          userId,
          profileId,
          collections.accounts as AccountRecord[],
          collections.profiles as Array<{ id: string }>
        )
        const settings = (collections.profile_settings as ProfileSettingsRecord[] | undefined) ?? []
        const current = this.normalize(settings.find(item => item.profileId === profileId))
        const next = this.normalize({ profileId, ...current, ...patch })
        const nextRecord: ProfileSettingsRecord = { profileId, ...next }

        return {
          records: {
            ...collections,
            profile_settings: [
              ...settings.filter(item => item.profileId !== profileId),
              nextRecord
            ]
          },
          result: next
        }
      }
    )
  }

  private assertOwnsProfile(
    userId: string,
    profileId: string,
    accounts: AccountRecord[],
    profiles: Array<{ id: string }>
  ): void {
    const account = accounts.find(item => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    if (!profiles.some(profile => profile.id === profileId)) {
      throw new NotFoundException('PROFILE_NOT_FOUND')
    }
    if (!account.profiles.includes(profileId)) throw new ForbiddenException('PROFILE_NOT_OWNED')
  }

  private normalize(
    value?: Partial<ProfileSettings> | { profileId: string } & Partial<ProfileSettings>
  ): ProfileSettings {
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
