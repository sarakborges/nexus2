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
    const page = await this.data.getPublicCommunities(q.page)
    return {
      ...page,
      items: page.items.map(community => ({
        ...community,
        about: sanitizeRichText(community.about ?? '')
      }))
    }

  }
  async getCommunity(url: string, userId: string | null = null): Promise<Community> {
    return this.data.getCommunityByUrl(normalizeEntityUrl(url), userId).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('COMMUNITY_NOT_FOUND')) throw new NotFoundException('COMMUNITY_NOT_FOUND')
      if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      throw error
    }).then(community => ({ ...community, about: sanitizeRichText(community.about ?? '') }))

  }
  async getCommunitiesByIds(ids: string[]): Promise<Community[]> {
    return (await this.access.readCommunitiesByIds(ids))
      .filter(community => community.privacy === 'public')
  }
  async listProfileCommunities(profileId: string, q: PaginationDto): Promise<PaginatedResult<Community>> {
    return this.data.getProfileCommunities(profileId, q.page).then(page => ({
      ...page, items: page.items.map(community => ({
        ...community, about: sanitizeRichText(community.about ?? '')
      }))
    })).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('PROFILE_NOT_FOUND')) throw new NotFoundException('PROFILE_NOT_FOUND')
      throw error
    })

  }
  async createCommunity(userId: string, ownerProfileId: string, input: CreateCommunityInput): Promise<Community> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const privacy = input.privacy ?? 'public'
    const createdAt = Date.now()
    const communityId = randomUUID()
    try {
      return await this.data.createCommunity({
        userId,
        ownerProfileId,
        id: communityId,
        name,
        url,
        picture,
        about,
        privacy,
        createdAt,
        avatarPath: this.uploads?.getAvatarPath(picture) ?? null,
        editorImageIds: this.uploads?.getEditorImageIds(about) ?? []
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async updateCommunity(userId: string, communityId: string, input: CreateCommunityInput): Promise<Community> {
    const name = input.name.trim()
    const url = normalizeEntityUrl(input.url || name)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const lastActivity = Date.now()
    let result: { community: Community; previousPicture: string | null }
    try {
      result = await this.data.updateCommunity({
        userId,
        communityId,
        name,
        url,
        picture,
        about,
        privacy: input.privacy ?? null,
        lastActivity,
        avatarPath: this.uploads?.getAvatarPath(picture) ?? null,
        editorImageIds: this.uploads?.getEditorImageIds(about) ?? []
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
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

  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    if (message.includes('PROFILE_NOT_OWNED') || message.includes('PROFILE_TYPE_MISMATCH')) {
      throw new ForbiddenException(message.includes('PROFILE_TYPE_MISMATCH')
        ? 'PROFILE_TYPE_MISMATCH'
        : 'PROFILE_NOT_OWNED')
    }
    if (message.includes('PROFILE_NOT_FOUND')) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (message.includes('COMMUNITY_NOT_FOUND')) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (message.includes('COMMUNITY_URL_ALREADY_IN_USE')) throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
    if (message.includes('INVALID_AVATAR_UPLOAD')) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    if (message.includes('INVALID_EDITOR_IMAGE')) throw new BadRequestException('INVALID_EDITOR_IMAGE')
    if (message.includes('INVALID_COMMUNITY')) throw new BadRequestException('INVALID_COMMUNITY')
    throw error
  }


}
