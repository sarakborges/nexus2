import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type { Community, CommunityRelationship, CommunityRelationshipType, Profile } from '@nexus/common'
import { DATA_REPOSITORY, type CollectionRecordMap, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class DomainAccessService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository
  ) {}

  async readProfilesByIds(ids: string[]): Promise<Profile[]> {
    return this.normalizeProfiles(await this.data.getProfilesByIds(ids))
  }

  async readCommunitiesByIds(ids: string[]): Promise<Community[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []
    return this.normalizeCommunities(await this.data.getCommunitiesByIds(uniqueIds))
  }

  normalizeProfiles(profiles: Profile[]): Profile[] {
    return profiles.map(profile => {
      const createdAt = Number.isFinite(profile.createdAt) ? profile.createdAt : 0
      return {
        ...profile,
        about: sanitizeRichText(profile.about ?? ''),
        createdAt,
        lastActivity: Number.isFinite(profile.lastActivity)
          ? profile.lastActivity
          : createdAt
      }
    })
  }

  touchProfilesActivity(
    profiles: readonly Profile[],
    profileIds: readonly string[],
    lastActivity: number
  ): Profile[] {
    const activeIds = new Set(profileIds)
    return profiles.map(profile => activeIds.has(profile.id)
      ? {
          ...profile,
          createdAt: Number.isFinite(profile.createdAt) ? profile.createdAt : 0,
          lastActivity
        }
      : profile
    )
  }

  touchCommunityActivity(
    communities: readonly Community[],
    communityId: string,
    lastActivity: number
  ): Community[] {
    return communities.map(community => community.id === communityId
      ? {
          ...community,
          createdAt: Number.isFinite(community.createdAt) ? community.createdAt : 0,
          lastActivity
        }
      : community
    )
  }

  normalizeCommunitiesInRecords(collections: CollectionRecordMap): {
    records: CollectionRecordMap
    communities: Community[]
  } {
    const stored = collections.communities as Community[]
    const profiles = collections.profiles as Profile[]
    const relationships = collections.community_relationships as CommunityRelationship[]
    const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
    const ownerProfileByCommunityId = new Map<string, string>()
    for (const relationship of relationships) {
      const communityId = relationship.profiles[1]
      if (relationship.type === 'owner' && !ownerProfileByCommunityId.has(communityId)) {
        ownerProfileByCommunityId.set(communityId, relationship.profiles[0])
      }
    }
    const communities = this.normalizeCommunities(
      stored,
      profileTypes,
      ownerProfileByCommunityId
    )
    const hasNormalizationChanges = stored.some((community, index) =>
      communities[index].type !== community.type ||
      communities[index].privacy !== community.privacy
    )
    return {
      records: hasNormalizationChanges ? { ...collections, communities } : collections,
      communities
    }
  }

  private normalizeCommunities(
    stored: Community[],
    profileTypes: ReadonlyMap<string, Profile['type']> = new Map(),
    ownerProfileByCommunityId: ReadonlyMap<string, string> = new Map()
  ): Community[] {
    return stored.map(community => {
      const ownerProfileId = ownerProfileByCommunityId.get(community.id)
      const inheritedType = ownerProfileId ? profileTypes.get(ownerProfileId) : undefined
      const privacy = ['public', 'private', 'unlisted'].includes(community.privacy)
        ? community.privacy
        : 'public'
      const createdAt = Number.isFinite(community.createdAt) ? community.createdAt : 0
      return {
        ...community,
        ...(inheritedType ? { type: inheritedType } : {}),
        privacy,
        about: sanitizeRichText(community.about ?? ''),
        createdAt,
        lastActivity: Number.isFinite(community.lastActivity)
          ? community.lastActivity
          : createdAt
      }
    })
  }

  assertOwnsInRecords(
    userId: string,
    profileId: string,
    accounts: readonly AccountRecord[],
    profiles: readonly Profile[],
    options: { allowDifferentActiveType?: boolean } = {}
  ): void {
    const account = accounts.find(item => item.id === userId)
    if (!account || !account.profiles.includes(profileId)) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    if (!account.currentProfile || options.allowDifferentActiveType) return

    const currentProfile = profiles.find(profile => profile.id === account.currentProfile)
    const targetProfile = profiles.find(profile => profile.id === profileId)
    if (currentProfile && targetProfile && currentProfile.type !== targetProfile.type) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
  }

  assertCommunityProfileInRecords(
    userId: string,
    profileId: string,
    communityId: string,
    accounts: readonly AccountRecord[],
    profiles: readonly Profile[],
    communities: readonly Community[],
    relationships: readonly CommunityRelationship[],
    options: { allowDifferentActiveType?: boolean } = {}
  ): { profile: Profile; community: Community; role: CommunityRelationshipType | null } {
    this.assertOwnsInRecords(userId, profileId, accounts, profiles, options)

    const profile = profiles.find(item => item.id === profileId)
    if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const community = communities.find(item => item.id === communityId)
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')

    const ownerProfileId = relationships.find(record =>
      record.profiles[1] === communityId && record.type === 'owner'
    )?.profiles[0]
    const ownerProfile = ownerProfileId
      ? profiles.find(item => item.id === ownerProfileId)
      : undefined
    const effectiveCommunity = ownerProfile
      ? { ...community, type: ownerProfile.type }
      : community

    this.assertSameType(profile, effectiveCommunity)
    return {
      profile,
      community: effectiveCommunity,
      role: this.role(profileId, relationships.filter(record => record.profiles[1] === communityId))
    }
  }

  assertForumMemberInRecords(
    userId: string,
    profileId: string,
    communityId: string,
    accounts: readonly AccountRecord[],
    profiles: readonly Profile[],
    communities: readonly Community[],
    relationships: readonly CommunityRelationship[]
  ): void {
    const context = this.assertCommunityProfileInRecords(
      userId, profileId, communityId, accounts, profiles, communities, relationships,
      { allowDifferentActiveType: true }
    )
    if (!['owner', 'moderator', 'connection'].includes(context.role ?? '')) {
      throw new ForbiddenException('COMMUNITY_MEMBER_REQUIRED')
    }
  }

  assertForumStaffInRecords(
    userId: string,
    profileId: string,
    communityId: string,
    accounts: readonly AccountRecord[],
    profiles: readonly Profile[],
    communities: readonly Community[],
    relationships: readonly CommunityRelationship[]
  ): void {
    const context = this.assertCommunityProfileInRecords(
      userId, profileId, communityId, accounts, profiles, communities, relationships,
      { allowDifferentActiveType: true }
    )
    if (!['owner', 'moderator'].includes(context.role ?? '')) {
      throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    }
  }


  assertSameType(source?: Profile, target?: Profile | Community): void {
    if (!source || !target) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (source.type !== target.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
  }

  role(profileId: string, records: CommunityRelationship[]): CommunityRelationshipType | null {
    return records.find(record => record.profiles[0] === profileId)?.type ?? null
  }

  isCommunityMemberInRecords(
    communityId: string,
    userId: string | null,
    accounts: readonly AccountRecord[],
    relationships: readonly CommunityRelationship[]
  ): boolean {
    if (!userId) return false
    const account = accounts.find(item => item.id === userId)
    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    const ownedProfiles = new Set(account.profiles)
    return relationships.some(record =>
      record.profiles[1] === communityId &&
      ownedProfiles.has(record.profiles[0]) &&
      ['owner', 'moderator', 'connection'].includes(record.type)
    )
  }

  assertCommunityReadableInRecords(
    communityId: string,
    userId: string | null,
    accounts: readonly AccountRecord[],
    communities: readonly Community[],
    relationships: readonly CommunityRelationship[]
  ): void {
    const community = communities.find(item => item.id === communityId)
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    const privacy = ['public', 'private', 'unlisted'].includes(community.privacy)
      ? community.privacy
      : 'public'
    if (privacy !== 'private') return
    if (!userId) throw new NotFoundException('COMMUNITY_NOT_FOUND')

    if (!this.isCommunityMemberInRecords(communityId, userId, accounts, relationships)) {
      throw new NotFoundException('COMMUNITY_NOT_FOUND')
    }
  }

}
