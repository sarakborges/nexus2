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
    if (this.data.getCommunityForumComposerPage) {
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
    return this.data.transaction<CommunityForumComposerPageData>(
      COMMUNITY_FORUM_COMPOSER_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const community = normalized.communities.find(
          (item) => item.url === normalizedUrl
        )
        if (!community) {
          return {
            records,
            result: { community: null, forumProfile: null, viewerRelationship: null, currentProfileType: null }
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
            result: {
              community: visibleCommunity,
              forumProfile: null,
              viewerRelationship: null,
              currentProfileType: null
            }
          }
        }

        const profiles = records.profiles as Profile[]
        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile] as const)
        )
        const ownedProfileIds = new Set(account.profiles)
        const currentProfileId = account.currentProfile && ownedProfileIds.has(account.currentProfile)
          ? account.currentProfile
          : null
        const currentProfileType = currentProfileId
          ? profilesById.get(currentProfileId)?.type ?? null
          : null
        const viewerRelationship = currentProfileId
          ? relationships.find((relationship) =>
              relationship.profiles[0] === currentProfileId &&
              relationship.profiles[1] === community.id
            ) ?? null
          : null
        const roleByProfileId = new Map(
          relationships
            .filter(
              (relationship) =>
                relationship.profiles[1] === community.id &&
                ownedProfileIds.has(relationship.profiles[0]) &&
                profilesById.get(relationship.profiles[0])?.type === community.type
            )
            .map((relationship) => [
              relationship.profiles[0],
              relationship.type
            ] as const)
        )
        const eligibleProfiles = profiles.filter((profile) => {
          const role = roleByProfileId.get(profile.id)
          return (
            profile.type === community.type &&
            role !== undefined &&
            PUBLISH_ROLES.includes(role)
          )
        })
        const forumProfileRecord =
          eligibleProfiles.find((profile) => profile.id === currentProfileId) ??
          eligibleProfiles.find(
            (profile) => roleByProfileId.get(profile.id) === 'owner'
          ) ??
          eligibleProfiles.find(
            (profile) => roleByProfileId.get(profile.id) === 'moderator'
          ) ??
          eligibleProfiles[0] ??
          null
        const forumProfile = forumProfileRecord
          ? {
              ...forumProfileRecord,
              about: sanitizeRichText(forumProfileRecord.about ?? '')
            }
          : null

        return {
          records,
          result: {
            community: visibleCommunity,
            forumProfile,
            viewerRelationship,
            currentProfileType
          }
        }
      }
    )
  }
}
