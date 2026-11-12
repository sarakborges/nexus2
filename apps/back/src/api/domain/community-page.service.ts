import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicSummary,
  CommunityPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships',
  'community_forum_topics',
  'community_forum_replies'
] as const

const FIRST_PAGE = { page: 1, pageSize: 20 } as PaginationDto

@Injectable()
export class CommunityPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityPage(
    url: string,
    userId: string | null
  ): Promise<CommunityPageData> {
    const normalizedUrl = normalizeEntityUrl(url)

    return this.data.getCommunityPage(normalizedUrl, userId).then(page => ({
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
