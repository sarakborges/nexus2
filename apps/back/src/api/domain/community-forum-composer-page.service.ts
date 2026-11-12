import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  Community,
  CommunityForumComposerPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_FORUM_COMPOSER_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships'
] as const

const PUBLISH_ROLES: CommunityRelationship['type'][] = [
  'owner',
  'moderator',
  'connection'
]

@Injectable()
export class CommunityForumComposerPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

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
