import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { CommunitiesPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { CommunitiesPageDto } from './domain.dto'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class CommunitiesPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getCommunitiesPage(userId: string, query: CommunitiesPageDto): Promise<CommunitiesPageData> {
    return this.data.getCommunitiesPage(
      userId,
      query.page,
      query.query,
      query.sort,
      query.communityTab
    ).then(page => ({
      ...page,
      currentProfile: page.currentProfile ? {
        ...page.currentProfile,
        about: sanitizeRichText(page.currentProfile.about ?? '')
      } : null,
      communities: {
        ...page.communities,
        items: page.communities.items.map(community => ({
          ...community,
          about: sanitizeRichText(community.about ?? '')
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
