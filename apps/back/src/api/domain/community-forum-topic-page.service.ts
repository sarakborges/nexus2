import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type { CommunityForumTopicPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { PaginationDto } from '../pagination/pagination.dto'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class CommunityForumTopicPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getCommunityForumTopicPage(
    url: string,
    topicId: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<CommunityForumTopicPageData> {
    const normalizedUrl = normalizeEntityUrl(url)
    return this.data.getCommunityForumTopicPage(
      normalizedUrl,
      topicId,
      userId,
      query.page,
      query.query,
      query.sort ?? 'activity-asc'
    ).then(page => ({
      ...page,
      authors: page.authors.map(profile => ({
        ...profile,
        about: sanitizeRichText(profile.about ?? '')
      }))
    })).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      if (message.includes('COMMUNITY_NOT_FOUND')) {
        throw new NotFoundException('COMMUNITY_NOT_FOUND')
      }
      if (message.includes('FORUM_TOPIC_NOT_FOUND')) {
        throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
      }
      throw error
    })
  }
}
