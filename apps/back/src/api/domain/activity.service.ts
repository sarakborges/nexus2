import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  Community,
  CommunityRelationship,
  ProfilePost,
  RecentActivity,
  Relationship
} from '@nexus/common'
import {
  DATA_REPOSITORY,
  type CollectionRecordMap,
  type CollectionTransaction,
  type DataRepository
} from '../../storage/repository.interface'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

const COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'relationships',
  'community_relationships',
  'profile_posts'
] as const

@Injectable()
export class ActivityService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  getRecentActivityFromRecords(
    userId: string,
    collections: CollectionRecordMap
  ): CollectionTransaction<RecentActivity[]> {
    const normalized = this.access.normalizeCommunitiesInRecords(collections)
    return this.getRecentActivityFromNormalizedRecords(
      userId,
      normalized.records,
      normalized.communities
    )
  }

  getRecentActivityFromNormalizedRecords(
    userId: string,
    records: CollectionRecordMap,
    communities: Community[]
  ): CollectionTransaction<RecentActivity[]> {
    const account = (
      records.accounts as Array<{ id: string; profiles: string[] }>
    ).find((item) => item.id === userId)

    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')

    const ownedProfileIds = new Set(account.profiles)
    if (!ownedProfileIds.size) return { records, result: [] }

    const profiles = records.profiles as import('@nexus/common').Profile[]
    const relationships = records.relationships as Relationship[]
    const communityRelationships =
      records.community_relationships as CommunityRelationship[]
    const profilePosts = (records.profile_posts as ProfilePost[] | undefined) ?? []
    const profilesById = new Map(
      profiles.map((profile) => [profile.id, profile] as const)
    )
    const communitiesById = new Map(
      communities.map((community) => [community.id, community] as const)
    )
    const activities: RecentActivity[] = []
    const visibleProfileIds = new Set(ownedProfileIds)

    for (const relationship of relationships) {
      if (relationship.type !== 'connection') continue
      const ownedParticipants = relationship.profiles.filter((id) =>
        ownedProfileIds.has(id)
      )
      if (ownedParticipants.length !== 1) continue

      const profile = profilesById.get(ownedParticipants[0])
      const friendId = relationship.profiles.find(
        (id) => id !== ownedParticipants[0]
      )
      const friend = friendId ? profilesById.get(friendId) : undefined
      if (!profile || !friend || profile.type !== friend.type) continue
      visibleProfileIds.add(friend.id)

      activities.push({
        id: 'friend:' + relationship.profiles[0] + ':' + relationship.profiles[1],
        type: 'friend_connected',
        updatedAt: relationship.updatedAt,
        profile,
        friend
      })
    }

    for (const relationship of communityRelationships) {
      if (!ownedProfileIds.has(relationship.profiles[0])) continue
      if (
        relationship.type !== 'owner' &&
        relationship.type !== 'moderator' &&
        relationship.type !== 'connection'
      ) continue

      const profile = profilesById.get(relationship.profiles[0])
      const community = communitiesById.get(relationship.profiles[1])
      if (!profile || !community || profile.type !== community.type) continue

      if (relationship.type === 'owner' && Number.isFinite(community.createdAt)) {
        activities.push({
          id: 'community-created:' + community.id,
          type: 'community_created',
          updatedAt: community.createdAt,
          profile,
          community
        })
      }

      activities.push({
        id: 'community:' + profile.id + ':' + community.id,
        type: 'community_membership',
        updatedAt: relationship.updatedAt,
        profile,
        community,
        role: relationship.type
      })
    }

    for (const post of profilePosts) {
      if (!visibleProfileIds.has(post.profileId)) continue
      const profile = profilesById.get(post.profileId)
      if (!profile) continue
      activities.push({
        id: 'post:' + post.id,
        type: 'profile_post',
        updatedAt: post.createdAt,
        profile,
        content: sanitizeRichText(post.content ?? '')
      })
    }

    const result = activities
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))


    return { records, result }
  }

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    return this.data.transaction<RecentActivity[]>(
      COLLECTIONS,
      (collections) => this.getRecentActivityFromRecords(userId, collections)
    )
  }
}
