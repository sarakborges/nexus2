import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { CommunityPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class CommunityPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getCommunityPage(url: string, userId: string | null): Promise<CommunityPageData> {
    return this.data.getCommunityPage(normalizeEntityUrl(url), userId).then(page => ({
      ...page,
      members: {
        ...page.members,
        items: page.members.items.map(profile => ({
          ...profile,
          about: sanitizeRichText(profile.about ?? '')
        }))
      },
      forumAuthors: page.forumAuthors.map(profile => ({
        ...profile,
        about: sanitizeRichText(profile.about ?? '')
      }))
    })).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      throw error
    })
  }
}
