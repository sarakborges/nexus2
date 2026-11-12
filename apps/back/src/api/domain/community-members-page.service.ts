import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type {
  CommunityMember,
  CommunityMembersPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { CommunityMembersPageDto } from './community-members-page.dto'
import { paginate } from '../pagination/pagination.helper'
import { filterAndSortList } from '../pagination/list-query.helper'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_MEMBERS_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships'
] as const

@Injectable()
export class CommunityMembersPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityMembersPage(
    communityUrl: string,
    query: CommunityMembersPageDto,
    userId: string | null
  ): Promise<CommunityMembersPageData> {
    return this.data.getCommunityMembersPage(
      communityUrl,
      userId,
      query.page,
      query.pendingPage,
      query.query,
      query.sort,
      query.tab
    ).then(page => ({
      ...page,
      members: {
        ...page.members,
        items: page.members.items.map(profile => ({
          ...profile,
          about: sanitizeRichText(profile.about ?? '')
        }))
      },
      pending: {
        ...page.pending,
        items: page.pending.items.map(profile => ({
          ...profile,
          about: sanitizeRichText(profile.about ?? '')
        }))
      }
    })).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      if (message.includes('COMMUNITY_NOT_FOUND')) {
        throw new NotFoundException('COMMUNITY_NOT_FOUND')
      }
      throw error
    })

  }
}
