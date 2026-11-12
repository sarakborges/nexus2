import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type {
  ActivityFeedCursor,
  ActivityFeedPage,
  Community,
  CommunityRelationship,
  ProfilePost,
  RecentActivity,
  Relationship
} from '@nexus/common'
import {
  DATA_REPOSITORY,
  type ActivityFeedRow,
  type CollectionRecordMap,
  type CollectionTransaction,
  type DataRepository
} from '../../storage/repository.interface'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

type StoredFeedActivity = {
  id: string
  type: RecentActivity['type']
  profileId: string
  friendId?: string | null
  communityId?: string | null
  postId?: string | null
  role?: 'owner' | 'moderator' | 'connection' | null
  updatedAt: number
}

const COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'relationships',
  'community_relationships',
  'profile_posts',
  'profile_settings',
  'feed_activities'
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
      records.accounts as Array<{ id: string; profiles: string[]; currentProfile?: string | null }>
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
      if (!visibleProfileIds.has(relationship.profiles[0])) continue
      if (
        relationship.type !== 'owner' &&
        relationship.type !== 'moderator' &&
        relationship.type !== 'connection'
      ) continue

      const profile = profilesById.get(relationship.profiles[0])
      const community = communitiesById.get(relationship.profiles[1])
      if (!profile || !community || profile.type !== community.type) continue
      const isOwnedProfile = ownedProfileIds.has(relationship.profiles[0])
      if (!isOwnedProfile && community.privacy !== 'public') continue

      if (relationship.type === 'owner' && Number.isFinite(community.createdAt) && community.createdAt > 0) {
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

    const settingsRecords = (records.profile_settings as Array<{
      profileId: string
      publishActivityTypes?: RecentActivity['type'][]
      showFriendActivityTypes?: RecentActivity['type'][]
    }> | undefined) ?? []
    const settingsByProfileId = new Map(settingsRecords.map(item => [item.profileId, item] as const))
    const activeProfileId = account.currentProfile && ownedProfileIds.has(account.currentProfile)
      ? account.currentProfile
      : account.profiles[0]
    const viewerSettings = settingsByProfileId.get(activeProfileId)
    const visibleActivityTypes = new Set(viewerSettings?.showFriendActivityTypes ?? [
      'friend_connected', 'profile_post', 'community_created', 'community_membership'
    ])
    const result = activities
      .filter(activity => {
        const publisherSettings = settingsByProfileId.get(activity.profile.id)
        const publishedTypes = publisherSettings?.publishActivityTypes ?? [
          'friend_connected', 'profile_post', 'community_created', 'community_membership'
        ]
        if (!publishedTypes.includes(activity.type)) return false
        return ownedProfileIds.has(activity.profile.id) || visibleActivityTypes.has(activity.type)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))

    return { records, result }
  }

  getRecentActivityFromFeedRecords(
    userId: string,
    records: CollectionRecordMap,
    communities: Community[]
  ): RecentActivity[] {
    const feedRecords = records.feed_activities as StoredFeedActivity[] | undefined
    if (!feedRecords?.length) {
      return this.getRecentActivityFromNormalizedRecords(userId, records, communities).result
    }

    const account = (
      records.accounts as Array<{ id: string; profiles: string[]; currentProfile?: string | null }>
    ).find(item => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')

    const ownedProfileIds = new Set(account.profiles)
    if (!ownedProfileIds.size) return []

    const profiles = records.profiles as import('@nexus/common').Profile[]
    const relationships = records.relationships as Relationship[]
    const posts = (records.profile_posts as ProfilePost[] | undefined) ?? []
    const settings = (records.profile_settings as Array<{
      profileId: string
      publishActivityTypes?: RecentActivity['type'][]
      showFriendActivityTypes?: RecentActivity['type'][]
    }> | undefined) ?? []
    const profilesById = new Map(profiles.map(profile => [profile.id, profile] as const))
    const communitiesById = new Map(communities.map(community => [community.id, community] as const))
    const postsById = new Map(posts.map(post => [post.id, post] as const))
    const settingsByProfileId = new Map(settings.map(item => [item.profileId, item] as const))
    const visibleProfileIds = new Set(ownedProfileIds)

    for (const relationship of relationships) {
      if (relationship.type !== 'connection') continue
      const ownedParticipants = relationship.profiles.filter(id => ownedProfileIds.has(id))
      if (ownedParticipants.length !== 1) continue
      const profile = profilesById.get(ownedParticipants[0])
      const friendId = relationship.profiles.find(id => id !== ownedParticipants[0])
      const friend = friendId ? profilesById.get(friendId) : undefined
      if (!profile || !friend || profile.type !== friend.type) continue
      visibleProfileIds.add(friend.id)
    }

    const activeProfileId = account.currentProfile && ownedProfileIds.has(account.currentProfile)
      ? account.currentProfile
      : account.profiles[0]
    const viewerSettings = settingsByProfileId.get(activeProfileId)
    const allTypes: RecentActivity['type'][] = [
      'friend_connected',
      'profile_post',
      'community_created',
      'community_membership'
    ]
    const visibleActivityTypes = new Set(viewerSettings?.showFriendActivityTypes ?? allTypes)
    const activities: RecentActivity[] = []

    for (const item of feedRecords) {
      if (!Number.isFinite(item.updatedAt)) continue

      if (item.type === 'friend_connected') {
        const participants = [item.profileId, item.friendId].filter((id): id is string => Boolean(id))
        const ownedParticipants = participants.filter(id => ownedProfileIds.has(id))
        if (ownedParticipants.length !== 1 || participants.length !== 2) continue
        const profile = profilesById.get(ownedParticipants[0])
        const friendId = participants.find(id => id !== ownedParticipants[0])
        const friend = friendId ? profilesById.get(friendId) : undefined
        if (!profile || !friend || profile.type !== friend.type) continue
        const publisherSettings = settingsByProfileId.get(profile.id)
        if (!(publisherSettings?.publishActivityTypes ?? allTypes).includes(item.type)) continue
        if (!visibleActivityTypes.has(item.type)) continue
        activities.push({ id: item.id, type: item.type, updatedAt: item.updatedAt, profile, friend })
        continue
      }

      const profile = profilesById.get(item.profileId)
      if (!profile || !visibleProfileIds.has(profile.id)) continue
      const publisherSettings = settingsByProfileId.get(profile.id)
      if (!(publisherSettings?.publishActivityTypes ?? allTypes).includes(item.type)) continue
      const isOwnedProfile = ownedProfileIds.has(profile.id)
      if (!isOwnedProfile && !visibleActivityTypes.has(item.type)) continue

      if (item.type === 'profile_post') {
        const post = item.postId ? postsById.get(item.postId) : undefined
        if (!post) continue
        activities.push({
          id: item.id,
          type: item.type,
          updatedAt: item.updatedAt,
          profile,
          content: sanitizeRichText(post.content ?? '')
        })
        continue
      }

      const community = item.communityId ? communitiesById.get(item.communityId) : undefined
      if (!community || community.type !== profile.type) continue
      if (!isOwnedProfile && community.privacy !== 'public') continue

      if (item.type === 'community_created') {
        activities.push({ id: item.id, type: item.type, updatedAt: item.updatedAt, profile, community })
      } else if (item.type === 'community_membership' && item.role) {
        activities.push({
          id: item.id,
          type: item.type,
          updatedAt: item.updatedAt,
          profile,
          community,
          role: item.role
        })
      }
    }

    return activities.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  }

  async getRecentActivityPage(
    userId: string,
    limit = 10,
    cursor: ActivityFeedCursor | null = null
  ): Promise<ActivityFeedPage> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50)
    const rows = await this.data.getActivityFeedRows(userId, safeLimit + 1, cursor)
    const hasMore = rows.length > safeLimit
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows
    const items = pageRows.map(row => this.toRecentActivity(row))
    const lastItem = pageRows[pageRows.length - 1]

    return {
      items,
      nextCursor: hasMore && lastItem
        ? { updatedAt: lastItem.updated_at_ms, id: lastItem.id }
        : null,
      hasMore
    }
  }

  private toRecentActivity(row: ActivityFeedRow): RecentActivity {
    if (!Number.isFinite(row.updated_at_ms)) {
      throw new Error('Supabase relational activity feed returned an invalid timestamp.')
    }

    switch (row.type) {
      case 'friend_connected':
        if (!row.friend) throw new Error('Friend activity is missing its related profile.')
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          friend: row.friend
        }
      case 'profile_post':
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          content: sanitizeRichText(row.content ?? '')
        }
      case 'community_created':
        if (!row.community) throw new Error('Community activity is missing its community.')
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          community: row.community
        }
      case 'community_membership':
        if (!row.community || !row.role) {
          throw new Error('Community membership activity is missing its community or role.')
        }
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          community: row.community,
          role: row.role
        }
    }

    throw new Error('Unsupported relational activity type.')
  }

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    const items: RecentActivity[] = []
    let cursor: ActivityFeedCursor | null = null

    for (;;) {
      const page = await this.getRecentActivityPage(userId, 50, cursor)
      items.push(...page.items)
      if (!page.hasMore || !page.nextCursor) return items
      cursor = page.nextCursor
    }
  }
}
