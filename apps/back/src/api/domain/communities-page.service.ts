import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Community, CommunitiesPageData, Profile } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITIES_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships'
] as const

@Injectable()
export class CommunitiesPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunitiesPage(
    userId: string,
    query: PaginationDto
  ): Promise<CommunitiesPageData> {
    return this.data.transaction<CommunitiesPageData>(
      COMMUNITIES_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const account = (records.accounts as AccountRecord[]).find(
          (item) => item.id === userId
        )
        if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')

        const profilesById = new Map(
          (records.profiles as Profile[]).map((profile) => [profile.id, profile] as const)
        )
        const currentProfileRecord =
          (account.currentProfile && account.profiles.includes(account.currentProfile)
            ? profilesById.get(account.currentProfile)
            : undefined) ??
          account.profiles
            .map((profileId) => profilesById.get(profileId))
            .find((profile): profile is Profile => Boolean(profile)) ??
          null
        const currentProfile = currentProfileRecord
          ? {
              ...currentProfileRecord,
              about: sanitizeRichText(currentProfileRecord.about ?? '')
            }
          : null
        const communities = normalized.communities.filter(
          (community: Community) => community.privacy === 'public'
        )

        return {
          records,
          result: {
            currentProfile,
            communities: paginate(communities, query)
          }
        }
      }
    )
  }
}
