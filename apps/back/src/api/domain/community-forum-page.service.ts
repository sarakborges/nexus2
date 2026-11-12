import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { CommunityForumPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { PaginationDto } from '../pagination/pagination.dto'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class CommunityForumPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getCommunityForumPage(
    url: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<CommunityForumPageData> {
    const normalizedUrl = normalizeEntityUrl(url)
    return this.data.getCommunityForumPage(
      normalizedUrl,
      userId,
      query.page,
      query.query,
      query.sort
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
      throw error
    })
  }
}
