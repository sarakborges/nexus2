import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type {
  Community,
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicDetail,
  CommunityForumTopicPageData,
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

const COMMUNITY_FORUM_TOPIC_PAGE_COLLECTIONS = [
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
export class CommunityForumTopicPageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getCommunityForumTopicPage(
    url: string,
    topicId: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<CommunityForumTopicPageData> {
    const normalizedUrl = normalizeEntityUrl(url)

    return this.data.transaction<CommunityForumTopicPageData>(
      COMMUNITY_FORUM_TOPIC_PAGE_COLLECTIONS,
      (collections) => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const community = normalized.communities.find(
          (item) => item.url === normalizedUrl
        )
        if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')

        const accounts = records.accounts as AccountRecord[]
        const account = userId
          ? accounts.find((item) => item.id === userId)
          : undefined
        if (userId && !account) {
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        }

        const communityRelationships =
          records.community_relationships as CommunityRelationship[]
        this.access.assertCommunityReadableInRecords(
          community.id,
          userId,
          accounts,
          normalized.communities,
          communityRelationships
        )

        const profiles = records.profiles as Profile[]
        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile] as const)
        )
        const ownedProfileIds = new Set(account?.profiles ?? [])
        const viewerRelationships = communityRelationships.filter(
          (relationship) =>
            relationship.profiles[1] === community.id &&
            ownedProfileIds.has(relationship.profiles[0]) &&
            profilesById.get(relationship.profiles[0])?.type === community.type
        )
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
        const currentProfileId = account?.currentProfile && ownedProfileIds.has(account.currentProfile) ? account.currentProfile : null
        const currentProfileType = currentProfileId ? profilesById.get(currentProfileId)?.type ?? null : null
        const viewerRelationship = currentProfileId ? viewerRelationships.find((relationship) => relationship.profiles[0] === currentProfileId) ?? null : null
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
        const forumProfileId = forumProfile?.id ?? null
        const currentRole = forumProfileId
          ? (rolesByProfileId.get(forumProfileId) ?? null)
          : null
        const isMember = Boolean(forumProfileId)
        const isStaff = currentRole === 'owner' || currentRole === 'moderator'

        const topics = records.community_forum_topics as CommunityForumTopic[]
        const topic = topics.find(
          (item) => item.id === topicId && item.communityId === community.id
        )
        if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')

        const profilesById = new Map(profiles.map(profile => [profile.id, profile] as const))
        const allReplies = filterAndSortList(
          (records.community_forum_replies as CommunityForumReply[]).filter(reply => reply.topicId === topicId && reply.communityId === community.id),
          query.query,
          query.sort,
          reply => [reply.content, profilesById.get(reply.profileId)?.name ?? '', profilesById.get(reply.profileId)?.url ?? ''].join(' '),
          reply => reply.createdAt,
          reply => profilesById.get(reply.profileId)?.name ?? '',
          reply => reply.id
        )
        const detail: CommunityForumTopicDetail = {
          topic: { ...topic, replyCount: allReplies.length },
          replies: paginate(allReplies, query)
        }

        const authorIds = new Set([
          topic.profileId,
          ...detail.replies.items.map((reply) => reply.profileId)
        ])
        const authors = profiles
          .filter((profile) => authorIds.has(profile.id))
          .map((profile) => ({
            ...profile,
            about: sanitizeRichText(profile.about ?? '')
          }))

        return {
          records,
          result: {
            community,
            detail,
            forumProfileId,
            viewerRelationship,
            currentProfileType,
            isMember,
            isStaff,
            authors
          }
        }
      }
    )
  }
}
