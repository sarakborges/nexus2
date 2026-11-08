import { Inject, Injectable } from '@nestjs/common'
import type {
  Community,
  CommunityRelationship,
  HomePageData,
  Profile,
  Relationship
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { ActivityService } from './activity.service'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

const HOME_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'relationships',
  'community_relationships'
] as const

const FIRST_PAGE = { page: 1, pageSize: 20 } as PaginationDto

@Injectable()
export class HomePageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly activity: ActivityService,
    private readonly access: DomainAccessService
  ) {}

  getHomePage(userId: string): Promise<HomePageData> {
    return this.data.transaction<HomePageData>(
      HOME_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const activity = this.activity.getRecentActivityFromNormalizedRecords(
          userId,
          normalized.records,
          normalized.communities
        )
        const records = activity.records
        const account = (records.accounts as AccountRecord[]).find(
          (item) => item.id === userId
        )!
        const allProfiles = records.profiles as Profile[]
        const ownedProfileIds = new Set(account.profiles)
        const ownedProfiles = allProfiles
          .filter((profile) => ownedProfileIds.has(profile.id))
          .map((profile) => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))
        const currentProfile =
          ownedProfiles.find((profile) => profile.id === account.currentProfile) ??
          ownedProfiles[0] ??
          null

        const communities = normalized.communities
        const profilesById = new Map(
          allProfiles.map((profile) => [profile.id, profile] as const)
        )
        const communitiesById = new Map(
          communities.map((community) => [community.id, community] as const)
        )
        const relationships = records.relationships as Relationship[]
        const communityRelationships =
          records.community_relationships as CommunityRelationship[]

        const friendIds = new Set(
          currentProfile
            ? relationships
                .filter(
                  (relationship) =>
                    relationship.type === 'connection' &&
                    relationship.profiles.includes(currentProfile.id)
                )
                .map((relationship) =>
                  relationship.profiles.find((id) => id !== currentProfile.id)!
                )
            : []
        )
        const friends = currentProfile
          ? allProfiles
              .filter(
                (profile) =>
                  friendIds.has(profile.id) &&
                  profile.type === currentProfile.type
              )
              .map((profile) => ({
                ...profile,
                about: sanitizeRichText(profile.about ?? '')
              }))
          : []

        const currentCommunityIds = new Set(
          currentProfile
            ? communityRelationships
                .filter(
                  (relationship) =>
                    relationship.profiles[0] === currentProfile.id &&
                    (relationship.type === 'owner' ||
                      relationship.type === 'moderator' ||
                      relationship.type === 'connection')
                )
                .map((relationship) => relationship.profiles[1])
            : []
        )
        const profileCommunities = currentProfile
          ? communities.filter(
              (community) =>
                currentCommunityIds.has(community.id) &&
                community.type === currentProfile.type &&
                community.privacy === 'public'
            )
          : []

        const ownedCommunityIds = new Set(
          communityRelationships
            .filter((relationship) => {
              if (!ownedProfileIds.has(relationship.profiles[0])) return false
              if (
                relationship.type !== 'owner' &&
                relationship.type !== 'moderator' &&
                relationship.type !== 'connection'
              ) return false

              const profile = profilesById.get(relationship.profiles[0])
              const community = communitiesById.get(relationship.profiles[1])
              return Boolean(
                profile &&
                  community &&
                  community.privacy === 'public' &&
                  profile.type === community.type
              )
            })
            .map((relationship) => relationship.profiles[1])
        )
        const publicCommunityPage = paginate(
          communities.filter((community) => community.privacy === 'public'),
          FIRST_PAGE
        )
        const suggestions = currentProfile
          ? publicCommunityPage.items
              .filter(
                (community) =>
                  community.type === currentProfile.type &&
                  !ownedCommunityIds.has(community.id)
              )
              .slice(0, 8)
          : []

        return {
          records,
          result: {
            currentProfile,
            activities: activity.result,
            friends: paginate(friends, FIRST_PAGE),
            communities: paginate(profileCommunities, FIRST_PAGE),
            suggestions
          }
        }
      }
    )
  }
}
