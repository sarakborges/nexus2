import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Profile, ProfileEditPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const PROFILE_EDIT_PAGE_COLLECTIONS = ['accounts', 'profiles'] as const

@Injectable()
export class ProfileEditPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getProfileEditPage(
    url: string,
    userId: string | null
  ): Promise<ProfileEditPageData> {
    const normalizedUrl = normalizeEntityUrl(url)
    if (this.data.getProfileEditPage) {
      return this.data.getProfileEditPage(normalizedUrl, userId).then(page => ({
        ...page,
        profile: page.profile ? {
          ...page.profile,
          about: sanitizeRichText(page.profile.about ?? '')
        } : null
      })).catch(error => {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('ACCOUNT_NOT_FOUND')) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }
        throw error
      })
    }
    return this.data.transaction<ProfileEditPageData>(
      PROFILE_EDIT_PAGE_COLLECTIONS,
      (collections) => {
        const accounts = collections.accounts as AccountRecord[]
        const account = userId
          ? accounts.find((item) => item.id === userId)
          : undefined
        if (userId && !account) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }

        const profiles = collections.profiles as Profile[]
        const profileRecord = profiles.find(
          (profile) => profile.url === normalizedUrl
        )
        if (!profileRecord) {
          return {
            records: collections,
            result: { profile: null, currentProfileType: null }
          }
        }

        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile] as const)
        )
        const currentProfileType =
          account?.currentProfile && account.profiles.includes(account.currentProfile)
            ? profilesById.get(account.currentProfile)?.type ?? null
            : null

        return {
          records: collections,
          result: {
            profile: {
              ...profileRecord,
              about: sanitizeRichText(profileRecord.about ?? '')
            },
            currentProfileType
          }
        }
      }
    )
  }
}
