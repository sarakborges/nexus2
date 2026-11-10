import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  Community,
  CommunityRelationship,
  Profile,
  ProfileDirectoryPageData,
  Relationship
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const PROFILE_DIRECTORY_COLLECTIONS = [
  'accounts',
  'profiles',
  'relationships',
  'communities',
  'community_relationships'
] as const

@Injectable()
export class ProfileDirectoryPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getProfileDirectoryPage(
    url: string,
    kind: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<ProfileDirectoryPageData> {
    if (kind !== 'friends' && kind !== 'communities') {
      throw new BadRequestException('INVALID_PROFILE_DIRECTORY')
    }

    const normalizedUrl = normalizeEntityUrl(url)
    return this.data.transaction<ProfileDirectoryPageData>(
      PROFILE_DIRECTORY_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const accounts = records.accounts as AccountRecord[]
        const account = userId ? accounts.find((item) => item.id === userId) : undefined
        if (userId && !account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const profileRecord = (records.profiles as Profile[]).find(
          (profile) => profile.url === normalizedUrl
        )

        if (!profileRecord) {
          if (kind === 'friends') {
            return {
              records,
              result: {
                kind: 'friends',
                profile: null,
                viewerRelationship: null,
                currentProfileType: null,
                friendRelationships: [],
                friends: paginate<Profile>([], query)
              }
            }
          }
          return {
            records,
            result: {
              kind: 'communities',
              profile: null,
              viewerRelationship: null,
              currentProfileType: null,
              communities: paginate<Community>([], query)
            }
          }
        }

        const profile = {
          ...profileRecord,
          about: sanitizeRichText(profileRecord.about ?? '')
        }
        const ownedProfileIds = new Set(account?.profiles ?? [])
        const currentProfileId = account?.currentProfile && ownedProfileIds.has(account.currentProfile) ? account.currentProfile : null
        const currentProfileType = currentProfileId ? (records.profiles as Profile[]).find((item) => item.id === currentProfileId)?.type ?? null : null
        const relationships = records.relationships as Relationship[]
        const viewerRelationship = currentProfileId && currentProfileId !== profile.id
          ? relationships.find((relationship) => relationship.profiles.includes(currentProfileId) && relationship.profiles.includes(profile.id)) ?? null
          : null

        if (kind === 'friends') {
          const relationships = records.relationships as Relationship[]
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
          const friends = (records.profiles as Profile[])
            .filter(
              (friend) =>
                friendIds.has(friend.id) && friend.type === profile.type
            )
            .map((friend) => ({
              ...friend,
              about: sanitizeRichText(friend.about ?? '')
            }))

          const friendPage = paginate(friends, query)
          const pageFriendIds = new Set(friendPage.items.map((friend) => friend.id))
          const friendRelationships = currentProfileId
            ? relationships.filter((relationship) => relationship.profiles.includes(currentProfileId) && relationship.profiles.some((profileId) => pageFriendIds.has(profileId)))
            : []
          return {
            records,
            result: {
              kind: 'friends',
              profile,
              viewerRelationship,
              currentProfileType,
              friendRelationships,
              friends: friendPage
            }
          }
        }

        const communityRelationships =
          records.community_relationships as CommunityRelationship[]
        const ownedCommunityIds = new Set(
          communityRelationships
            .filter(
              (relationship) =>
                relationship.profiles[0] === profile.id &&
                ['owner', 'moderator', 'connection'].includes(
                  relationship.type
                )
            )
            .map((relationship) => relationship.profiles[1])
        )
        const communities = normalized.communities.filter(
          (community) =>
            ownedCommunityIds.has(community.id) &&
            community.type === profile.type &&
            community.privacy === 'public'
        )

        return {
          records,
          result: {
            kind: 'communities',
            profile,
            viewerRelationship,
            currentProfileType,
            communities: paginate(communities, query)
          }
        }
      }
    )
  }
}
