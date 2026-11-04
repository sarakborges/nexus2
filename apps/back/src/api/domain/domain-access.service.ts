import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Community, CommunityRelationship, CommunityRelationshipType, Profile } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import type { AccountRecord } from '../auth/auth.types'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class DomainAccessService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService
  ) {}

  async readProfiles(): Promise<Profile[]> {
    const profiles = await this.data.read<Profile>('profiles')
    return profiles.map(profile => ({
      ...profile,
      about: sanitizeRichText(profile.about ?? '')
    }))
  }

  async readCommunities(): Promise<Community[]> {
    const [stored, profiles, relationships] = await Promise.all([
      this.data.read<Community>('communities'),
      this.readProfiles(),
      this.data.read<CommunityRelationship>('community_relationships')
    ])
    const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
    const ownerProfileByCommunityId = new Map<string, string>()
    for (const relationship of relationships) {
      const communityId = relationship.profiles[1]
      if (relationship.type === 'owner' && !ownerProfileByCommunityId.has(communityId)) {
        ownerProfileByCommunityId.set(communityId, relationship.profiles[0])
      }
    }

    const normalizeCommunity = (community: Community): Community => {
      const ownerProfileId = ownerProfileByCommunityId.get(community.id)
      const inheritedType = ownerProfileId ? profileTypes.get(ownerProfileId) : undefined
      const privacy = ['public', 'private', 'unlisted'].includes(community.privacy)
        ? community.privacy
        : 'public'
      return {
        ...community,
        ...(inheritedType ? { type: inheritedType } : {}),
        privacy,
        about: sanitizeRichText(community.about ?? '')
      }
    }

    const communities = stored.map(normalizeCommunity)
    const hasNormalizationChanges = stored.some((community, index) =>
      communities[index].type !== community.type ||
      communities[index].privacy !== community.privacy
    )

    if (hasNormalizationChanges) {
      await this.data.update<Community>('communities', current => {
        const normalized = current.map(normalizeCommunity)
        const hasChanges = normalized.some((community, index) =>
          community.type !== current[index].type ||
          community.privacy !== current[index].privacy
        )
        return hasChanges ? normalized : current
      })
    }
    return communities
  }

  async readCommunityRelationships(communityId: string): Promise<CommunityRelationship[]> {
    return (await this.data.read<CommunityRelationship>('community_relationships'))
      .filter(record => record.profiles[1] === communityId)
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

  async assertOwns(
    userId: string,
    profileId: string,
    options: { allowDifferentActiveType?: boolean } = {}
  ): Promise<void> {
    if (!await this.auth.ownsProfile(userId, profileId)) throw new ForbiddenException('PROFILE_NOT_OWNED')
    const user = await this.auth.getUser(userId)
    if (!user.currentProfile || options.allowDifferentActiveType) return
    const profiles = await this.readProfiles()
    const currentProfile = profiles.find(profile => profile.id === user.currentProfile)
    const targetProfile = profiles.find(profile => profile.id === profileId)
    if (currentProfile && targetProfile && currentProfile.type !== targetProfile.type) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
  }

  assertSameType(source?: Profile, target?: Profile | Community): void {
    if (!source || !target) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (source.type !== target.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
  }

  role(profileId: string, records: CommunityRelationship[]): CommunityRelationshipType | null {
    return records.find(record => record.profiles[0] === profileId)?.type ?? null
  }

  async isCommunityMember(communityId: string, userId: string | null): Promise<boolean> {
    if (!userId) return false
    const user = await this.auth.getUser(userId)
    const ownedProfileIds = new Set(user.profiles)
    const relationships = await this.readCommunityRelationships(communityId)
    return relationships.some(record =>
      ownedProfileIds.has(record.profiles[0]) && ['owner', 'moderator', 'connection'].includes(record.type)
    )
  }

  async assertCommunityReadable(communityId: string, userId: string | null): Promise<void> {
    const community = (await this.readCommunities()).find(item => item.id === communityId)
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (community.privacy === 'private' && !(await this.isCommunityMember(communityId, userId))) {
      throw new NotFoundException('COMMUNITY_NOT_FOUND')
    }
  }

  async ensureCommunity(id: string): Promise<void> {
    if (!(await this.readCommunities()).some(community => community.id === id)) {
      throw new NotFoundException('COMMUNITY_NOT_FOUND')
    }
  }

  async assertStaff(profileId: string, communityId: string): Promise<void> {
    await this.ensureCommunity(communityId)
    const [profiles, communities, records] = await Promise.all([
      this.readProfiles(),
      this.readCommunities(),
      this.readCommunityRelationships(communityId)
    ])
    this.assertSameType(
      profiles.find(profile => profile.id === profileId),
      communities.find(community => community.id === communityId)
    )
    if (!['owner', 'moderator'].includes(this.role(profileId, records) ?? '')) {
      throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    }
  }

  async assertForumMember(userId: string, profileId: string, communityId: string): Promise<void> {
    await this.assertOwns(userId, profileId, { allowDifferentActiveType: true })
    await this.ensureCommunity(communityId)
    const [profiles, communities, records] = await Promise.all([
      this.readProfiles(),
      this.readCommunities(),
      this.readCommunityRelationships(communityId)
    ])
    this.assertSameType(
      profiles.find(profile => profile.id === profileId),
      communities.find(community => community.id === communityId)
    )
    if (!['owner', 'moderator', 'connection'].includes(this.role(profileId, records) ?? '')) {
      throw new ForbiddenException('COMMUNITY_MEMBER_REQUIRED')
    }
  }

  async assertForumStaff(userId: string, profileId: string, communityId: string): Promise<void> {
    await this.assertOwns(userId, profileId, { allowDifferentActiveType: true })
    await this.ensureCommunity(communityId)
    const [profiles, communities, records] = await Promise.all([
      this.readProfiles(),
      this.readCommunities(),
      this.readCommunityRelationships(communityId)
    ])
    this.assertSameType(
      profiles.find(profile => profile.id === profileId),
      communities.find(community => community.id === communityId)
    )
    if (!['owner', 'moderator'].includes(this.role(profileId, records) ?? '')) {
      throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    }
  }
}
