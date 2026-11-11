import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicSummary,
  CommunityForumPageData,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { filterAndSortList } from '../pagination/list-query.helper'
import { DomainAccessService } from './domain-access.service'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

const COMMUNITY_FORUM_PAGE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'community_relationships',
  'community_forum_topics',
  'community_forum_replies'
] as const

const ACTIVE_MEMBER_ROLES: CommunityRelationship['type'][] = [
  'owner',
  'moderator',
  'connection'
]

@Injectable()
export class CommunityForumPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityForumPage(
    url: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<CommunityForumPageData> {
    const normalizedUrl = normalizeEntityUrl(url)

    return this.data.transaction<CommunityForumPageData>(
      COMMUNITY_FORUM_PAGE_COLLECTIONS,
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
              viewerRelationship: null,
              currentProfileType: null,
              canReadForum: false,
              canPublish: false,
              topics: paginate<CommunityForumTopicSummary>([], query),
              authors: []
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
        const communityRelationships = allRelationships.filter(
          (relationship) => relationship.profiles[1] === community.id
        )
        const viewerRelationships = communityRelationships.filter(
          (relationship) =>
            ownedProfileIds.has(relationship.profiles[0]) &&
            profilesById.get(relationship.profiles[0])?.type === community.type
        )
        const currentProfileId = account?.currentProfile && ownedProfileIds.has(account.currentProfile) ? account.currentProfile : null
        const currentProfileType = currentProfileId ? profilesById.get(currentProfileId)?.type ?? null : null
        const viewerRelationship = currentProfileId ? viewerRelationships.find((relationship) => relationship.profiles[0] === currentProfileId) ?? null : null
        const rolesByProfileId = new Map(
          viewerRelationships.map((relationship) => [
            relationship.profiles[0],
            relationship.type
          ] as const)
        )
        const ownedProfiles = profiles
          .filter((profile) => ownedProfileIds.has(profile.id))
          .map((profile) => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))
        const eligibleProfiles = ownedProfiles.filter((profile) => {
          const role = rolesByProfileId.get(profile.id)
          return (
            profile.type === community.type &&
            role !== undefined &&
            ACTIVE_MEMBER_ROLES.includes(role)
          )
        })
        const forumProfile =
          eligibleProfiles.find((profile) => profile.id === currentProfileId) ??
          eligibleProfiles.find(
            (profile) => rolesByProfileId.get(profile.id) === 'owner'
          ) ??
          eligibleProfiles.find(
            (profile) => rolesByProfileId.get(profile.id) === 'moderator'
          ) ??
          eligibleProfiles[0] ??
          null
        const canPublish = Boolean(forumProfile)
        const canReadForum =
          community.privacy !== 'private' ||
          communityRelationships.some(
            (relationship) =>
              ownedProfileIds.has(relationship.profiles[0]) &&
              ACTIVE_MEMBER_ROLES.includes(relationship.type)
          )
        const visibleCommunity =
          community.privacy === 'private' && !canReadForum
            ? { ...community, picture: '', about: '' }
            : community

        const forumTopics = records.community_forum_topics as CommunityForumTopic[]
        const forumReplies = records.community_forum_replies as CommunityForumReply[]
        const replyCounts = new Map<string, number>()
        for (const reply of forumReplies) {
          if (reply.communityId !== community.id) continue
          replyCounts.set(
            reply.topicId,
            (replyCounts.get(reply.topicId) ?? 0) + 1
          )
        }

        const visibleTopics = canReadForum
          ? filterAndSortList(
              forumTopics.filter(topic => topic.communityId === community.id).map(topic => ({ ...topic, replyCount: replyCounts.get(topic.id) ?? 0 })),
              query.query, query.sort,
              topic => [topic.title,topic.content].join(' '), topic => topic.updatedAt || topic.createdAt, topic => topic.title, topic => topic.id
            ).sort((a,b) => Number(b.isPinned)-Number(a.isPinned))
          : []
        const topics = paginate(visibleTopics, query)
        const authorIds = new Set(
          topics.items.map((topic) => topic.profileId)
        )
        const authors = profiles
          .filter((profile) => authorIds.has(profile.id))
          .map((profile) => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))

        return {
          records,
          result: {
            community: visibleCommunity,
            viewerRelationship,
            currentProfileType,
            canReadForum,
            canPublish,
            topics,
            authors
          }
        }
      }
    )
  }
}
