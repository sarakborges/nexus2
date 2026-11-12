import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { ProfilePageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ProfilePageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getProfilePage(url: string, userId: string | null): Promise<ProfilePageData> {
    return this.data.getProfilePage(normalizeEntityUrl(url), userId).then(page => ({
      ...page,
      profile: page.profile ? {
        ...page.profile,
        about: sanitizeRichText(page.profile.about ?? '')
      } : null,
      friends: {
        ...page.friends,
        items: page.friends.items.map(friend => ({
          ...friend,
          about: sanitizeRichText(friend.about ?? '')
        }))
      }
    })).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      throw error
    })
  }
}
