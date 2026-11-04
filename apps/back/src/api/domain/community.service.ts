import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
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
    const found = (await this.access.readCommunities()).find(community => community.url === normalizeEntityUrl(url))
    if (!found) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (found.privacy === 'private' && !(await this.access.isCommunityMember(found.id, userId))) {
      return { ...found, picture: '', about: '' }
    }
    return found
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
    await this.access.assertOwns(userId, ownerProfileId)
    const ownerProfile = (await this.access.readProfiles()).find(profile => profile.id === ownerProfileId)
    if (!ownerProfile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const privacy = input.privacy ?? 'public'
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['public', 'private', 'unlisted'].includes(privacy) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')

    const community: Community = { id: randomUUID(), name, url, picture, about, type: ownerProfile.type, privacy }
    const ownerRelationship: CommunityRelationship = {
      profiles: [ownerProfileId, community.id],
      type: 'owner',
      requestedBy: null,
      blockedBy: null,
      updatedAt: Date.now()
    }

    await this.data.transaction(['communities', 'community_relationships', 'media_files'], collections => {
      const communities = collections.communities as Community[]
      const relationships = collections.community_relationships as CommunityRelationship[]
      const mediaFiles = collections.media_files as UploadedFileRecord[]
      if (communities.some(item => item.url === url)) {
        throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
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
        result: undefined
      }
    })

    return community
  }

  async updateCommunity(userId: string, communityId: string, input: CreateCommunityInput): Promise<Community> {
    await this.access.ensureCommunity(communityId)
    const relationships = await this.access.readCommunityRelationships(communityId)
    const ownerProfileId = relationships.find(record => record.type === 'owner')?.profiles[0]
    if (!ownerProfileId) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    await this.access.assertOwns(userId, ownerProfileId)
    const ownerProfile = (await this.access.readProfiles()).find(profile => profile.id === ownerProfileId)
    if (!ownerProfile) throw new NotFoundException('PROFILE_NOT_FOUND')

    const communities = await this.access.readCommunities()
    const current = communities.find(community => community.id === communityId)
    if (!current) throw new NotFoundException('COMMUNITY_NOT_FOUND')

    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const privacy = input.privacy ?? current.privacy ?? 'public'
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['public', 'private', 'unlisted'].includes(privacy) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
    if (communities.some(community => community.id !== communityId && community.url === url)) {
      throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
    }

    if (picture !== current.picture) await this.uploads?.validateAvatarUrl(userId, picture, 'community-avatar')
    const newEditorImages = getNewEditorImages(about, current.about)
    await this.uploads?.validateEditorImages(userId, newEditorImages)

    let updated: Community | undefined
    await this.data.update<Community>('communities', currentCommunities => {
      const latest = currentCommunities.find(community => community.id === communityId)
      if (!latest) throw new NotFoundException('COMMUNITY_NOT_FOUND')
      if (currentCommunities.some(community => community.id !== communityId && community.url === url)) {
        throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
      }
      updated = { ...latest, name, url, picture, about, type: ownerProfile.type, privacy }
      return currentCommunities.map(community => community.id === communityId ? updated! : community)
    })
    if (picture !== current.picture) {
      await this.uploads?.attachAvatarUrl(userId, picture, 'community-avatar', 'community', communityId)
    }
    if (newEditorImages) {
      await this.uploads?.attachEditorImages(userId, newEditorImages, 'community', communityId)
    }
    return updated!
  }

  async getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    await this.access.ensureCommunity(communityId)
    if (!userId) return []
    const user = await this.auth.getUser(userId)
    const ownedProfileIds = new Set(user.profiles)
    const [records, community, profiles] = await Promise.all([
      this.access.readCommunityRelationships(communityId),
      this.access.readCommunities().then(items => items.find(item => item.id === communityId)),
      this.access.readProfiles()
    ])
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
    return records.filter(record => ownedProfileIds.has(record.profiles[0]) && profileTypes.get(record.profiles[0]) === community.type)
  }

  async listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.access.assertCommunityReadable(communityId, userId)
    if (!['all', 'staff', 'banned'].includes(tab)) throw new BadRequestException('INVALID_MEMBER_TAB')
    if (tab !== 'all') {
      if (!userId || !actorProfileId) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
      await this.access.assertOwns(userId, actorProfileId, { allowDifferentActiveType: true })
      await this.access.assertStaff(actorProfileId, communityId)
    }
    const records = await this.access.readCommunityRelationships(communityId)
    const types = tab === 'staff' ? ['owner', 'moderator'] : tab === 'banned' ? ['blocked'] : ['owner', 'moderator', 'connection']
    const matching = records.filter(r => types.includes(r.type))
    const byId = new Map(matching.map(r => [r.profiles[0], r.type]))
    const [profiles, community] = await Promise.all([this.access.readProfiles(), this.access.readCommunities().then(items => items.find(item => item.id === communityId))])
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    return paginate(profiles.filter(profile => byId.has(profile.id) && profile.type === community.type).map(profile => ({ ...profile, role: byId.get(profile.id)! })), q)
  }
  async listPendingMembers(userId: string, communityId: string, actorProfileId: string, q: PaginationDto): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.access.assertOwns(userId, actorProfileId, { allowDifferentActiveType: true })
    await this.access.assertStaff(actorProfileId, communityId)
    const records = (await this.access.readCommunityRelationships(communityId)).filter(r => r.type === 'requested')
    const ids = new Set(records.map(r => r.profiles[0]))
    const [profiles, community] = await Promise.all([this.access.readProfiles(), this.access.readCommunities().then(items => items.find(item => item.id === communityId))])
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    return paginate(profiles.filter(profile => ids.has(profile.id) && profile.type === community.type).map(profile => ({ ...profile, role: 'requested' })), q)
  }
  async updateCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string, type: CommunityRelationshipType): Promise<CommunityRelationship> {
    await this.access.assertOwns(userId, actorId)
    await this.access.ensureCommunity(communityId)
    const community = (await this.access.readCommunities()).find(item => item.id === communityId)
    const profiles = await this.access.readProfiles()
    const actorProfile = profiles.find(profile => profile.id === actorId)
    const targetProfile = profiles.find(profile => profile.id === targetId)
    this.access.assertSameType(actorProfile, community)
    this.access.assertSameType(targetProfile, community)
    let record: CommunityRelationship | undefined
    await this.data.update<CommunityRelationship>('community_relationships', all => {
      const communityRecords = all.filter(item => item.profiles[1] === communityId)
      const currentActorRole = this.access.role(actorId, communityRecords)
      const currentTargetRole = this.access.role(targetId, communityRecords)
      const self = actorId === targetId
      let allowed = false
      if (type === 'requested') allowed = self && currentTargetRole === null
      if (type === 'connection') allowed = (currentActorRole === 'owner' || currentActorRole === 'moderator') && currentTargetRole === 'requested'
      if (type === 'moderator') allowed = currentActorRole === 'owner' && currentTargetRole === 'connection'
      if (type === 'blocked') allowed = !self && (currentActorRole === 'owner' || currentActorRole === 'moderator') && currentTargetRole === 'connection'
      if (!allowed) throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')

      const next: CommunityRelationship = {
        profiles: [targetId, communityId], type,
        requestedBy: type === 'requested' ? actorId : null,
        blockedBy: type === 'blocked' ? actorId : null, updatedAt: Date.now()
      }
      record = next
      return [...all.filter(r => r.profiles[0] !== targetId || r.profiles[1] !== communityId), next]
    })
    return record!
  }
  async removeCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    await this.access.assertOwns(userId, actorId)
    await this.access.ensureCommunity(communityId)
    const [profiles, community] = await Promise.all([
      this.access.readProfiles(),
      this.access.readCommunities().then(items => items.find(item => item.id === communityId))
    ])
    this.access.assertSameType(profiles.find(profile => profile.id === actorId), community)
    this.access.assertSameType(profiles.find(profile => profile.id === targetId), community)
    await this.data.update<CommunityRelationship>('community_relationships', all => {
      const target = all.find(r => r.profiles[0] === targetId && r.profiles[1] === communityId)
      if (!target) return all
      const actorRole = this.access.role(actorId, all.filter(r => r.profiles[1] === communityId))
      const self = actorId === targetId
      const canSelf = self && (['connection', 'requested'].includes(target.type) || (target.type === 'blocked' && (target.blockedBy === actorId || target.blockedBy === null)))
      const canStaff = ['owner', 'moderator'].includes(actorRole ?? '') &&
        ['connection', 'requested', 'blocked'].includes(target.type) &&
        !(actorRole === 'moderator' && target.type === 'moderator')
      if (!canSelf && !canStaff) throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')
      return all.filter(r => r.profiles[0] !== targetId || r.profiles[1] !== communityId)
    })
  }
  async demoteModerator(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    await this.access.assertOwns(userId, actorId)
    await this.access.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.access.readProfiles(), this.access.readCommunities()])
    const community = communities.find(item => item.id === communityId)
    this.access.assertSameType(profiles.find(profile => profile.id === actorId), community)
    this.access.assertSameType(profiles.find(profile => profile.id === targetId), community)
    await this.data.update<CommunityRelationship>('community_relationships', all => {
      const filtered = all.filter(r => r.profiles[1] === communityId)
      if (this.access.role(actorId, filtered) !== 'owner' || this.access.role(targetId, filtered) !== 'moderator') {
        throw new ForbiddenException('ONLY_OWNER_CAN_DEMOTE_MODERATOR')
      }
      return all.map(r => r.profiles[0] === targetId && r.profiles[1] === communityId
        ? { ...r, type: 'connection', updatedAt: Date.now() }
        : r)
    })
  }
  async transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    await this.access.assertOwns(userId, actorId)
    await this.access.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.access.readProfiles(), this.access.readCommunities()])
    const community = communities.find(item => item.id === communityId)
    this.access.assertSameType(profiles.find(profile => profile.id === actorId), community)
    this.access.assertSameType(profiles.find(profile => profile.id === newOwnerId), community)
    await this.data.update<CommunityRelationship>('community_relationships', all => {
      const filtered = all.filter(r => r.profiles[1] === communityId)
      if (this.access.role(actorId, filtered) !== 'owner' || this.access.role(newOwnerId, filtered) !== 'moderator') {
        throw new ForbiddenException('OWNERSHIP_TRANSFER_NOT_ALLOWED')
      }
      return all.map(r => {
        if (r.profiles[1] !== communityId) return r
        if (r.profiles[0] === actorId) return { ...r, type: 'moderator', updatedAt: Date.now() }
        if (r.profiles[0] === newOwnerId) return { ...r, type: 'owner', updatedAt: Date.now() }
        return r
      })
    })
  }


}
