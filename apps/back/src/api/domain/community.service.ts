import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  Community,
  CommunityRelationship,
  CommunityRelationshipType,
  CreateCommunityInput,
  PaginatedResult,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import type { AccountRecord } from '../auth/auth.types'
import { paginate, type PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService, type UploadedFileRecord } from '../uploads/uploads.service'
import { DomainAccessService } from './domain-access.service'
import { getNewEditorImages, normalizeEntityUrl } from './domain.utils'

@Injectable()
export class CommunityService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async listCommunities(q: PaginationDto): Promise<PaginatedResult<Community>> {
    return paginate((await this.access.readCommunities()).filter(community => community.privacy === 'public'), q)
  }
  async getCommunity(url: string, userId: string | null = null): Promise<Community> {
    // Keep legacy type/privacy normalization, then authorize and read the preview from one snapshot.
    await this.access.readCommunities()
    return this.data.transaction<Community>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const found = (collections.communities as Community[])
          .find(community => community.url === normalizeEntityUrl(url))
        if (!found) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        const profiles = collections.profiles as Profile[]
        const relationships = collections.community_relationships as CommunityRelationship[]
        const ownerProfileId = relationships.find(record =>
          record.profiles[1] === found.id && record.type === 'owner'
        )?.profiles[0]
        const ownerProfile = ownerProfileId
          ? profiles.find(profile => profile.id === ownerProfileId)
          : undefined
        const privacy = ['public', 'private', 'unlisted'].includes(found.privacy)
          ? found.privacy
          : 'public'
        const normalized: Community = {
          ...found,
          ...(ownerProfile ? { type: ownerProfile.type } : {}),
          privacy,
          about: sanitizeRichText(found.about ?? '')
        }
        const result = privacy === 'private' &&
          !this.access.isCommunityMemberInRecords(
            found.id,
            userId,
            collections.accounts as AccountRecord[],
            relationships
          )
          ? { ...normalized, picture: '', about: '' }
          : normalized
        return { records: collections, result }
      }
    )
  }
  async getCommunitiesByIds(ids: string[]): Promise<Community[]> {
    const set = new Set(ids)
    return (await this.access.readCommunities()).filter(community => set.has(community.id) && community.privacy === 'public')
  }
  async listProfileCommunities(profileId: string, q: PaginationDto): Promise<PaginatedResult<Community>> {
    const profile = (await this.access.readProfiles()).find(item => item.id === profileId)
    if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const links = await this.data.read<CommunityRelationship>('community_relationships')
    const ids = new Set(links.filter(r => r.profiles[0] === profileId && ['owner', 'moderator', 'connection'].includes(r.type)).map(r => r.profiles[1]))
    return paginate((await this.access.readCommunities()).filter(community => ids.has(community.id) && community.type === profile.type && community.privacy === 'public'), q)
  }
  async createCommunity(userId: string, ownerProfileId: string, input: CreateCommunityInput): Promise<Community> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const privacy = input.privacy ?? 'public'
    const aboutText = getRichTextPlainText(about)
    const createdAt = Date.now()
    const communityId = randomUUID()
    return this.data.transaction<Community>(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const relationships = collections.community_relationships as CommunityRelationship[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, ownerProfileId, accounts, profiles)
        const ownerProfile = profiles.find(profile => profile.id === ownerProfileId)
        if (!ownerProfile) throw new NotFoundException('PROFILE_NOT_FOUND')
        if (!name || about.length > 12000 || aboutText.length > 500 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
          !['public', 'private', 'unlisted'].includes(privacy) ||
          (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
        if (communities.some(item => item.url === url)) {
          throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
        }

        const community: Community = {
          id: communityId, name, url, picture, about, type: ownerProfile.type, privacy
        }
        const ownerRelationship: CommunityRelationship = {
          profiles: [ownerProfileId, community.id],
          type: 'owner',
          requestedBy: null,
          blockedBy: null,
          updatedAt: createdAt
        }
        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(
              this.uploads.attachAvatarUrlToRecords(
                mediaFiles, userId, picture, 'community-avatar', 'community', community.id
              ),
              userId, about, 'community', community.id
            )
          : mediaFiles

        return {
          records: {
            ...collections,
            communities: [...communities, community],
            community_relationships: [...relationships, ownerRelationship],
            media_files: nextMediaFiles
          },
          result: community
        }
      }
    )
  }

  async updateCommunity(userId: string, communityId: string, input: CreateCommunityInput): Promise<Community> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const aboutText = getRichTextPlainText(about)
    return this.data.transaction<Community>(
      ['accounts', 'profiles', 'community_relationships', 'communities', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const relationships = collections.community_relationships as CommunityRelationship[]
        const communities = collections.communities as Community[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        const ownerProfileId = relationships.find(record =>
          record.type === 'owner' && record.profiles[1] === communityId
        )?.profiles[0]
        if (!ownerProfileId) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        this.access.assertOwnsInRecords(userId, ownerProfileId, accounts, profiles)

        const ownerProfile = profiles.find(profile => profile.id === ownerProfileId)
        if (!ownerProfile) throw new NotFoundException('PROFILE_NOT_FOUND')
        const latest = communities.find(community => community.id === communityId)
        if (!latest) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        if (!name || about.length > 12000 || aboutText.length > 500 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
          (input.privacy != null && !['public', 'private', 'unlisted'].includes(input.privacy)) ||
          (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
        if (communities.some(community => community.id !== communityId && community.url === url)) {
          throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
        }

        let nextMediaFiles = mediaFiles
        if (this.uploads) {
          if (picture !== latest.picture) {
            nextMediaFiles = this.uploads.attachAvatarUrlToRecords(
              nextMediaFiles, userId, picture, 'community-avatar', 'community', communityId
            )
          }
          nextMediaFiles = this.uploads.attachEditorImagesToRecords(
            nextMediaFiles,
            userId,
            getNewEditorImages(about, latest.about),
            'community',
            communityId
          )
        }

        const updated: Community = {
          ...latest,
          name,
          url,
          picture,
          about,
          type: ownerProfile.type,
          privacy: input.privacy ?? latest.privacy ?? 'public'
        }
        return {
          records: {
            ...collections,
            communities: communities.map(community => community.id === communityId ? updated : community),
            media_files: nextMediaFiles
          },
          result: updated
        }
      }
    )
  }


  async getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    await this.access.readCommunities()
    return this.data.transaction<CommunityRelationship[]>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const communities = collections.communities as Community[]
        const community = communities.find(item => item.id === communityId)
        if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        if (!userId) return { records: collections, result: [] }

        const accounts = collections.accounts as AccountRecord[]
        const account = accounts.find(item => item.id === userId)
        if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const profiles = collections.profiles as Profile[]
        const relationships = collections.community_relationships as CommunityRelationship[]
        const ownerProfileId = relationships.find(record =>
          record.profiles[1] === communityId && record.type === 'owner'
        )?.profiles[0]
        const ownerProfile = ownerProfileId
          ? profiles.find(profile => profile.id === ownerProfileId)
          : undefined
        const communityType = ownerProfile?.type ?? community.type
        const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
        const ownedProfileIds = new Set(account.profiles)
        const visible = relationships.filter(record =>
          record.profiles[1] === communityId &&
          ownedProfileIds.has(record.profiles[0]) &&
          profileTypes.get(record.profiles[0]) === communityType
        )
        return { records: collections, result: visible }
      }
    )
  }
  async listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.access.readCommunities()
    return this.data.transaction<PaginatedResult<Profile & { role: string }>>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const relationships = collections.community_relationships as CommunityRelationship[]
        this.access.assertCommunityReadableInRecords(
          communityId, userId, accounts, communities, relationships
        )
        if (!['all', 'staff', 'banned'].includes(tab)) {
          throw new BadRequestException('INVALID_MEMBER_TAB')
        }
        if (tab !== 'all') {
          if (!userId || !actorProfileId) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
          const context = this.access.assertCommunityProfileInRecords(
            userId, actorProfileId, communityId, accounts, profiles, communities, relationships,
            { allowDifferentActiveType: true }
          )
          if (!['owner', 'moderator'].includes(context.role ?? '')) {
            throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
          }
        }

        const community = communities.find(item => item.id === communityId)!
        const ownerProfileId = relationships.find(record =>
          record.profiles[1] === communityId && record.type === 'owner'
        )?.profiles[0]
        const ownerProfile = ownerProfileId
          ? profiles.find(profile => profile.id === ownerProfileId)
          : undefined
        const communityType = ownerProfile?.type ?? community.type
        const types = tab === 'staff'
          ? ['owner', 'moderator']
          : tab === 'banned' ? ['blocked'] : ['owner', 'moderator', 'connection']
        const roleByProfile = new Map(
          relationships
            .filter(record => record.profiles[1] === communityId && types.includes(record.type))
            .map(record => [record.profiles[0], record.type] as const)
        )
        const result = paginate(
          profiles
            .filter(profile => roleByProfile.has(profile.id) && profile.type === communityType)
            .map(profile => ({ ...profile, role: roleByProfile.get(profile.id)! })),
          q
        )
        return { records: collections, result }
      }
    )
  }

  async listPendingMembers(userId: string, communityId: string, actorProfileId: string, q: PaginationDto): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.access.readCommunities()
    return this.data.transaction<PaginatedResult<Profile & { role: string }>>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const relationships = collections.community_relationships as CommunityRelationship[]
        const context = this.access.assertCommunityProfileInRecords(
          userId, actorProfileId, communityId, accounts, profiles, communities, relationships,
          { allowDifferentActiveType: true }
        )
        if (!['owner', 'moderator'].includes(context.role ?? '')) {
          throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
        }
        const pendingIds = new Set(
          relationships
            .filter(record => record.profiles[1] === communityId && record.type === 'requested')
            .map(record => record.profiles[0])
        )
        const result = paginate(
          profiles
            .filter(profile => pendingIds.has(profile.id) && profile.type === context.community.type)
            .map(profile => ({ ...profile, role: 'requested' })),
          q
        )
        return { records: collections, result }
      }
    )
  }
  async updateCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string, type: CommunityRelationshipType): Promise<CommunityRelationship> {
    const now = Date.now()
    return this.data.transaction<CommunityRelationship>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const all = collections.community_relationships as CommunityRelationship[]
        const { community, role: currentActorRole } = this.access.assertCommunityProfileInRecords(
          userId, actorId, communityId, accounts, profiles, communities, all
        )
        const targetProfile = profiles.find(profile => profile.id === targetId)
        this.access.assertSameType(targetProfile, community)

        const communityRecords = all.filter(item => item.profiles[1] === communityId)
        const currentTargetRole = this.access.role(targetId, communityRecords)
        const self = actorId === targetId
        let allowed = false
        if (type === 'requested') allowed = self && currentTargetRole === null
        if (type === 'connection') allowed =
          (currentActorRole === 'owner' || currentActorRole === 'moderator') &&
          currentTargetRole === 'requested'
        if (type === 'moderator') allowed =
          currentActorRole === 'owner' && currentTargetRole === 'connection'
        if (type === 'blocked') allowed =
          !self &&
          (currentActorRole === 'owner' || currentActorRole === 'moderator') &&
          currentTargetRole === 'connection'
        if (!allowed) throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')

        const next: CommunityRelationship = {
          profiles: [targetId, communityId],
          type,
          requestedBy: type === 'requested' ? actorId : null,
          blockedBy: type === 'blocked' ? actorId : null,
          updatedAt: now
        }
        return {
          records: {
            ...collections,
            community_relationships: [
              ...all.filter(record =>
                record.profiles[0] !== targetId || record.profiles[1] !== communityId
              ),
              next
            ]
          },
          result: next
        }
      }
    )
  }

  async removeCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const all = collections.community_relationships as CommunityRelationship[]
        const { community, role: actorRole } = this.access.assertCommunityProfileInRecords(
          userId, actorId, communityId, accounts, profiles, communities, all
        )
        this.access.assertSameType(profiles.find(profile => profile.id === targetId), community)

        const target = all.find(record =>
          record.profiles[0] === targetId && record.profiles[1] === communityId
        )
        if (!target) return { records: collections, result: undefined }

        const self = actorId === targetId
        const canSelf = self && (
          ['connection', 'requested'].includes(target.type) ||
          (target.type === 'blocked' && (target.blockedBy === actorId || target.blockedBy === null))
        )
        const canStaff = ['owner', 'moderator'].includes(actorRole ?? '') &&
          ['connection', 'requested', 'blocked'].includes(target.type) &&
          !(actorRole === 'moderator' && target.type === 'moderator')
        if (!canSelf && !canStaff) throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')

        return {
          records: {
            ...collections,
            community_relationships: all.filter(record =>
              record.profiles[0] !== targetId || record.profiles[1] !== communityId
            )
          },
          result: undefined
        }
      }
    )
  }

  async demoteModerator(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    const now = Date.now()
    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const all = collections.community_relationships as CommunityRelationship[]
        const { community, role: actorRole } = this.access.assertCommunityProfileInRecords(
          userId, actorId, communityId, accounts, profiles, communities, all
        )
        this.access.assertSameType(profiles.find(profile => profile.id === targetId), community)
        const targetRole = this.access.role(
          targetId, all.filter(record => record.profiles[1] === communityId)
        )
        if (actorRole !== 'owner' || targetRole !== 'moderator') {
          throw new ForbiddenException('ONLY_OWNER_CAN_DEMOTE_MODERATOR')
        }
        return {
          records: {
            ...collections,
            community_relationships: all.map(record =>
              record.profiles[0] === targetId && record.profiles[1] === communityId
                ? { ...record, type: 'connection', updatedAt: now }
                : record
            )
          },
          result: undefined
        }
      }
    )
  }

  async transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    const now = Date.now()
    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const communities = collections.communities as Community[]
        const all = collections.community_relationships as CommunityRelationship[]
        const { community, role: actorRole } = this.access.assertCommunityProfileInRecords(
          userId, actorId, communityId, accounts, profiles, communities, all
        )
        this.access.assertSameType(profiles.find(profile => profile.id === newOwnerId), community)
        const communityRecords = all.filter(record => record.profiles[1] === communityId)
        if (actorRole !== 'owner' || this.access.role(newOwnerId, communityRecords) !== 'moderator') {
          throw new ForbiddenException('OWNERSHIP_TRANSFER_NOT_ALLOWED')
        }
        return {
          records: {
            ...collections,
            community_relationships: all.map(record => {
              if (record.profiles[1] !== communityId) return record
              if (record.profiles[0] === actorId) return { ...record, type: 'moderator', updatedAt: now }
              if (record.profiles[0] === newOwnerId) return { ...record, type: 'owner', updatedAt: now }
              return record
            })
          },
          result: undefined
        }
      }
    )
  }


}
