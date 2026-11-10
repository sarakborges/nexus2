import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
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
import type { CommunityMemberProfile } from './domain.types'
import { AuthService } from '../auth/auth.service'
import type { AccountRecord } from '../auth/auth.types'
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import type { UploadedFileRecord } from '../uploads/uploads.types'
import { DomainAccessService } from './domain-access.service'
import { CommunityMembershipService } from './community-membership.service'
import { getNewEditorImages, getRemovedEditorImages, normalizeEntityUrl } from './domain.utils'

@Injectable()
export class CommunityService {
  private readonly membership: CommunityMembershipService

  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService,
    @Optional() membership?: CommunityMembershipService
  ) {
    this.membership = membership ?? new CommunityMembershipService(data, access)
  }

  async listCommunities(q: PaginationDto): Promise<PaginatedResult<Community>> {
    return paginate((await this.access.readCommunities()).filter(community => community.privacy === 'public'), q)
  }
  async getCommunity(url: string, userId: string | null = null): Promise<Community> {
    return this.data.transaction<Community>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const found = normalized.communities.find(
          community => community.url === normalizeEntityUrl(url)
        )
        if (!found) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        const relationships = records.community_relationships as CommunityRelationship[]
        const result = found.privacy === 'private' &&
          !this.access.isCommunityMemberInRecords(
            found.id, userId, records.accounts as AccountRecord[], relationships
          )
          ? { ...found, picture: '', about: '' }
          : found
        return { records, result }
      }
    )
  }
  async getCommunitiesByIds(ids: string[]): Promise<Community[]> {
    return (await this.access.readCommunitiesByIds(ids))
      .filter(community => community.privacy === 'public')
  }
  async listProfileCommunities(profileId: string, q: PaginationDto): Promise<PaginatedResult<Community>> {
    return this.data.transaction<PaginatedResult<Community>>(
      ['profiles', 'communities', 'community_relationships'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const profiles = records.profiles as Profile[]
        const profile = profiles.find(item => item.id === profileId)
        if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
        const ownedCommunityIds = new Set(
          (records.community_relationships as CommunityRelationship[])
            .filter(record =>
              record.profiles[0] === profileId &&
              ['owner', 'moderator', 'connection'].includes(record.type)
            )
            .map(record => record.profiles[1])
        )
        const visible = normalized.communities.filter(community =>
          ownedCommunityIds.has(community.id) &&
          community.type === profile.type &&
          community.privacy === 'public'
        )
        return { records, result: paginate(visible, q) }
      }
    )
  }
  async createCommunity(userId: string, ownerProfileId: string, input: CreateCommunityInput): Promise<Community> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const privacy = input.privacy ?? 'public'
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
        if (!name || about.length > 8000 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
          !['public', 'private', 'unlisted'].includes(privacy) ||
          (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
        if (communities.some(item => item.url === url)) {
          throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
        }

        const community: Community = {
          id: communityId,
          name,
          url,
          picture,
          about,
          type: ownerProfile.type,
          privacy,
          createdAt,
          lastActivity: createdAt
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
            profiles: this.access.touchProfilesActivity(profiles, [ownerProfileId], createdAt),
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
    const lastActivity = Date.now()
    const result = await this.data.transaction<{ community: Community; previousPicture: string | null }>(
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
        if (!name || about.length > 8000 ||
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
          nextMediaFiles = this.uploads.detachEditorImagesFromRecords(
            nextMediaFiles,
            getRemovedEditorImages(latest.about, about),
            'community',
            communityId
          )
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
          privacy: input.privacy ?? latest.privacy ?? 'public',
          createdAt: Number.isFinite(latest.createdAt) ? latest.createdAt : 0,
          lastActivity
        }
        return {
          records: {
            ...collections,
            communities: communities.map(community => community.id === communityId ? updated : community),
            media_files: nextMediaFiles
          },
          result: {
            community: updated,
            previousPicture: picture !== latest.picture ? latest.picture : null
          }
        }
      }
    )
    if (result.previousPicture) await this.uploads?.deletePreviousAvatar(result.previousPicture)
    return result.community
  }

  getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    return this.membership.getCommunityRelationships(userId, communityId)
  }

  listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMemberProfile>> {
    return this.membership.listCommunityMembers(communityId, tab, q, userId, actorProfileId)
  }

  listPendingMembers(
    userId: string,
    communityId: string,
    actorProfileId: string,
    q: PaginationDto
  ): Promise<PaginatedResult<CommunityMemberProfile>> {
    return this.membership.listPendingMembers(userId, communityId, actorProfileId, q)
  }

  updateCommunityRelationship(
    userId: string,
    communityId: string,
    targetId: string,
    actorId: string,
    type: CommunityRelationshipType
  ): Promise<CommunityRelationship> {
    return this.membership.updateCommunityRelationship(userId, communityId, targetId, actorId, type)
  }

  removeCommunityRelationship(
    userId: string,
    communityId: string,
    targetId: string,
    actorId: string
  ): Promise<void> {
    return this.membership.removeCommunityRelationship(userId, communityId, targetId, actorId)
  }

  demoteModerator(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    return this.membership.demoteModerator(userId, communityId, targetId, actorId)
  }

  transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    return this.membership.transferOwnership(userId, communityId, newOwnerId, actorId)
  }

}
