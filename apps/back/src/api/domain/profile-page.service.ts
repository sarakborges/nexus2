import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  Community,
  CommunityRelationship,
  Profile,
  ProfilePageData,
  Relationship
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const PROFILE_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'relationships',
  'communities',
  'community_relationships'
] as const

const FIRST_PAGE = { page: 1, pageSize: 20 } as PaginationDto
const EMPTY_PAGE = paginate<Profile>([], FIRST_PAGE)

@Injectable()
export class ProfilePageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getProfilePage(url: string, userId: string | null): Promise<ProfilePageData> {
    const normalizedUrl = normalizeEntityUrl(url)

    return this.data.getProfilePage(normalizedUrl, userId).then(page => ({
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
