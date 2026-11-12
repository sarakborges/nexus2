import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicSummary,
  CommunityForumPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { filterAndSortList } from '../pagination/list-query.helper'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_FORUM_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships',
  'community_forum_topics',
  'community_forum_replies'
] as const

const ACTIVE_MEMBER_ROLES: CommunityRelationship['type'][] = [
  'owner',
  'moderator',
  'connection'
]

@Injectable()
export class CommunityForumPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

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
