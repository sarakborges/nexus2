import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Community, CommunityRelationship, CommunityRelationshipType, Profile } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
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
    let hasTypeChanges = false
    let hasPrivacyChanges = false
    const communities = stored.map(community => {
      const ownerProfileId = relationships.find(record =>
        record.profiles[1] === community.id && record.type === 'owner'
      )?.profiles[0]
      const inheritedType = ownerProfileId ? profileTypes.get(ownerProfileId) : undefined
      if (inheritedType && inheritedType !== community.type) hasTypeChanges = true
      const privacy = ['public', 'private', 'unlisted'].includes(community.privacy) ? community.privacy : 'public'
      if (privacy !== community.privacy) hasPrivacyChanges = true
      return {
        ...community,
        ...(inheritedType ? { type: inheritedType } : {}),
        privacy,
        about: sanitizeRichText(community.about ?? '')
      }
    })

    if (hasTypeChanges || hasPrivacyChanges) {
      await this.data.update<Community>('communities', current => current.map(community => {
        const ownerProfileId = relationships.find(record =>
          record.profiles[1] === community.id && record.type === 'owner'
        )?.profiles[0]
        const inheritedType = ownerProfileId ? profileTypes.get(ownerProfileId) : undefined
        const privacy = ['public', 'private', 'unlisted'].includes(community.privacy) ? community.privacy : 'public'
        return {
          ...community,
          ...(inheritedType ? { type: inheritedType } : {}),
          privacy,
          about: sanitizeRichText(community.about ?? '')
        }
      }))
    }
    return communities
  }

  async readCommunityRelationships(communityId: string): Promise<CommunityRelationship[]> {
    return (await this.data.read<CommunityRelationship>('community_relationships'))
      .filter(record => record.profiles[1] === communityId)
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
