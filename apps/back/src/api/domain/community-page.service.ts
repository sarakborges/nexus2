import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicSummary,
  CommunityPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships',
  'community_forum_topics',
  'community_forum_replies'
] as const

const FIRST_PAGE = { page: 1, pageSize: 20 } as PaginationDto

@Injectable()
export class CommunityPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityPage(
    url: string,
    userId: string | null
  ): Promise<CommunityPageData> {
    const normalizedUrl = normalizeEntityUrl(url)

    return this.data.transaction<CommunityPageData>(
      COMMUNITY_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const community = normalized.communities.find(
          (item) => item.url === normalizedUrl
        )

        if (!community) {
          return {
            records,
            result: {
              community: null,
              relationships: [],
              viewerRelationship: null,
              canViewMembers: false,
              canEditCommunity: false,
              pendingRequestCount: 0,
              members: paginate<Profile>([], FIRST_PAGE),
              forumTopics: paginate<CommunityForumTopicSummary>([], FIRST_PAGE),
              forumAuthors: []
            }
          }
        }

        const accounts = records.accounts as AccountRecord[]
        const account = userId
          ? accounts.find((item) => item.id === userId)
          : undefined
        if (userId && !account) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }

        const profiles = records.profiles as Profile[]
        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile] as const)
        )
        const ownedProfileIds = new Set(account?.profiles ?? [])
        const allRelationships =
          records.community_relationships as CommunityRelationship[]
        const relationships = allRelationships.filter((relationship) => {
          if (relationship.profiles[1] !== community.id) return false
          if (!ownedProfileIds.has(relationship.profiles[0])) return false
          return profilesById.get(relationship.profiles[0])?.type === community.type
        })

        const currentProfileId = account?.currentProfile && ownedProfileIds.has(account.currentProfile) ? account.currentProfile : null
        const viewerRelationship = currentProfileId ? relationships.find((relationship) => relationship.profiles[0] === currentProfileId) ?? null : null
        const canViewMembers =
          community.privacy !== 'private' ||
          relationships.some((relationship) =>
            ['owner', 'moderator', 'connection'].includes(relationship.type)
          )
        const canEditCommunity = relationships.some(
          (relationship) => relationship.type === 'owner'
        )
        const pendingActor =
          relationships.find((relationship) =>
            ['owner', 'moderator'].includes(relationship.type)
          ) ?? null
        const visibleCommunity =
          community.privacy === 'private' && !canViewMembers
            ? { ...community, picture: '', about: '' }
            : community

        const roleByProfileId = new Map(
          allRelationships
            .filter(
              (relationship) =>
                relationship.profiles[1] === community.id &&
                ['owner', 'moderator', 'connection'].includes(relationship.type)
            )
            .map((relationship) => [
              relationship.profiles[0],
              relationship.type
            ] as const)
        )
        const members = canViewMembers
          ? profiles
              .filter(
                (profile) =>
                  roleByProfileId.has(profile.id) &&
                  profile.type === community.type
              )
              .map((profile) => ({
                ...profile,
                about: sanitizeRichText(profile.about ?? '')
              }))
          : []
        const pendingRequestCount = pendingActor
          ? allRelationships.filter(
              (relationship) =>
                relationship.profiles[1] === community.id &&
                relationship.type === 'requested' &&
                profilesById.get(relationship.profiles[0])?.type === community.type
            ).length
          : 0

        const topics = records.community_forum_topics as CommunityForumTopic[]
        const replies = records.community_forum_replies as CommunityForumReply[]
        const replyCounts = new Map<string, number>()
        for (const reply of replies) {
          if (reply.communityId !== community.id) continue
          replyCounts.set(
            reply.topicId,
            (replyCounts.get(reply.topicId) ?? 0) + 1
          )
        }
        const visibleTopics = canViewMembers
          ? topics
              .filter((topic) => topic.communityId === community.id)
              .map((topic) => ({
                ...topic,
                replyCount: replyCounts.get(topic.id) ?? 0
              }))
              .sort(
                (a, b) =>
                  Number(b.isPinned) - Number(a.isPinned) ||
                  b.updatedAt - a.updatedAt ||
                  a.id.localeCompare(b.id)
              )
          : []
        const forumTopics = paginate(visibleTopics, FIRST_PAGE)
        const forumAuthorIds = new Set(
          forumTopics.items.map((topic) => topic.profileId)
        )
        const forumAuthors = profiles
          .filter((profile) => forumAuthorIds.has(profile.id))
          .map((profile) => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))

        return {
          records,
          result: {
            community: visibleCommunity,
            relationships,
            viewerRelationship,
            canViewMembers,
            canEditCommunity,
            pendingRequestCount,
            members: paginate(members, FIRST_PAGE),
            forumTopics,
            forumAuthors
          }
        }
      }
    )
  }
}
