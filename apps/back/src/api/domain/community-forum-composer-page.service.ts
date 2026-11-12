import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { CommunityForumComposerPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class CommunityForumComposerPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getCommunityForumComposerPage(
    url: string,
    userId: string | null
  ): Promise<CommunityForumComposerPageData> {
    const normalizedUrl = normalizeEntityUrl(url)
    return this.data.getCommunityForumComposerPage(normalizedUrl, userId).then(page => ({
      ...page,
      forumProfile: page.forumProfile ? {
        ...page.forumProfile,
        about: sanitizeRichText(page.forumProfile.about ?? '')
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
