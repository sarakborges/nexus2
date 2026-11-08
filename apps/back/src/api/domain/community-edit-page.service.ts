import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  Community,
  CommunityEditPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'

const COMMUNITY_EDIT_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships'
] as const

@Injectable()
export class CommunityEditPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityEditPage(
    url: string,
    userId: string | null
  ): Promise<CommunityEditPageData> {
    const normalizedUrl = normalizeEntityUrl(url)
    return this.data.transaction<CommunityEditPageData>(
      COMMUNITY_EDIT_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const community = normalized.communities.find(
          (item) => item.url === normalizedUrl
        )
        if (!community) {
          return {
            records,
            result: { community: null, ownerProfileId: null }
          }
        }

        const accounts = records.accounts as AccountRecord[]
        const account = userId
          ? accounts.find((item) => item.id === userId)
          : undefined
        if (userId && !account) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }
        const relationships = records.community_relationships as CommunityRelationship[]
        const isMember = account
          ? this.access.isCommunityMemberInRecords(
              community.id,
              userId,
              accounts,
              relationships
            )
          : false
        const visibleCommunity =
          community.privacy === 'private' && !isMember
            ? { ...community, picture: '', about: '' }
            : community

        if (!account) {
          return {
            records,
            result: { community: visibleCommunity, ownerProfileId: null }
          }
        }

        const profiles = records.profiles as Profile[]
        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile] as const)
        )
        const ownedProfileIds = new Set(account.profiles)
        const viewerRelationships = relationships.filter(
          (relationship) =>
            relationship.profiles[1] === community.id &&
            ownedProfileIds.has(relationship.profiles[0]) &&
            profilesById.get(relationship.profiles[0])?.type === community.type
        )
        const ownerProfileId =
          viewerRelationships.find((relationship) => relationship.type === 'owner')
            ?.profiles[0] ?? null

        return {
          records,
          result: { community: visibleCommunity, ownerProfileId }
        }
      }
    )
  }
}
