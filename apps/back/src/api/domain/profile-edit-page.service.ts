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
}
