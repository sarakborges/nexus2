import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
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
    return this.data.transaction<Community[]>(
      ['communities', 'profiles', 'community_relationships'],
      collections => {
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

        const normalized = stored.map(community => {
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
        })
        const hasNormalizationChanges = stored.some((community, index) =>
          normalized[index].type !== community.type ||
          normalized[index].privacy !== community.privacy
        )

        return {
          records: hasNormalizationChanges
            ? { ...collections, communities: normalized }
            : collections,
          result: normalized
        }
      }
    )
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
