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

    return this.data.transaction<ProfilePageData>(
      PROFILE_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const accounts = records.accounts as AccountRecord[]
        const account = userId ? accounts.find((item) => item.id === userId) : undefined
        if (userId && !account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const profiles = records.profiles as Profile[]
        const profileRecord = profiles.find(
          (profile) => profile.url === normalizedUrl
        )

        if (!profileRecord) {
          return {
            records,
            result: {
              profile: null,
              viewerRelationship: null,
              friends: EMPTY_PAGE,
              communities: { ...EMPTY_PAGE, items: [] }
            }
          }
        }

        const profile = {
          ...profileRecord,
          about: sanitizeRichText(profileRecord.about ?? '')
        }
        const relationships = records.relationships as Relationship[]
        const currentProfileId = account?.currentProfile && account.profiles.includes(account.currentProfile) ? account.currentProfile : null
        const viewerRelationship = currentProfileId && currentProfileId !== profile.id
          ? relationships.find((relationship) => relationship.profiles.includes(currentProfileId) && relationship.profiles.includes(profile.id)) ?? null
          : null
        const friendIds = new Set(
          relationships
            .filter(
              (relationship) =>
                relationship.type === 'connection' &&
                relationship.profiles.includes(profile.id)
            )
            .map((relationship) =>
              relationship.profiles.find((id) => id !== profile.id)!
            )
        )
        const friends = profiles
          .filter(
            (friend) =>
              friendIds.has(friend.id) && friend.type === profile.type
          )
          .map((friend) => ({
            ...friend,
            about: sanitizeRichText(friend.about ?? '')
          }))

        const communityRelationships =
          records.community_relationships as CommunityRelationship[]
        const communityIds = new Set(
          communityRelationships
            .filter(
              (relationship) =>
                relationship.profiles[0] === profile.id &&
                (relationship.type === 'owner' ||
                  relationship.type === 'moderator' ||
                  relationship.type === 'connection')
            )
            .map((relationship) => relationship.profiles[1])
        )
        const communities = normalized.communities.filter(
          (community: Community) =>
            communityIds.has(community.id) &&
            community.type === profile.type &&
            community.privacy === 'public'
        )

        return {
          records,
          result: {
            profile,
            viewerRelationship,
            friends: paginate(friends, FIRST_PAGE),
            communities: paginate(communities, FIRST_PAGE)
          }
        }
      }
    )
  }
}
