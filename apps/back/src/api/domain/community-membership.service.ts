import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import type {
  Community,
  CommunityRelationship,
  CommunityRelationshipType,
  PaginatedResult,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { CommunityMemberProfile } from './domain.types'
import type { AccountRecord } from '../auth/auth.types'
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { DomainAccessService } from './domain-access.service'

@Injectable()
export class CommunityMembershipService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  async getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    try {
      return await this.data.getCommunityRelationships(userId, communityId)
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMemberProfile>> {
    try {
      return await this.data.listCommunityMembers(
        communityId, tab, q.page, userId, actorProfileId
      )
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async listPendingMembers(userId: string, communityId: string, actorProfileId: string, q: PaginationDto): Promise<PaginatedResult<CommunityMemberProfile>> {
    try {
      return await this.data.listPendingMembers(userId, communityId, actorProfileId, q.page)
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async updateCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string, type: CommunityRelationshipType): Promise<CommunityRelationship> {
    const now = Date.now()
    try {
      await this.changeRelationship({
        userId,
        communityId,
        targetProfileId: targetId,
        actorProfileId: actorId,
        action: type,
        updatedAt: now
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
    return {
      profiles: [targetId, communityId],
      type,
      requestedBy: type === 'requested' ? actorId : null,
      blockedBy: type === 'blocked' ? actorId : null,
      updatedAt: now
    }
  }

  async removeCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    try {
      await this.changeRelationship({
        userId,
        communityId,
        targetProfileId: targetId,
        actorProfileId: actorId,
        action: 'remove',
        updatedAt: Date.now()
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async demoteModerator(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    try {
      await this.changeRelationship({
        userId,
        communityId,
        targetProfileId: targetId,
        actorProfileId: actorId,
        action: 'demote',
        updatedAt: Date.now()
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    try {
      await this.changeRelationship({
        userId,
        communityId,
        targetProfileId: newOwnerId,
        actorProfileId: actorId,
        action: 'transfer',
        updatedAt: Date.now()
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  private async changeRelationship(change: {
    userId: string
    communityId: string
    targetProfileId: string
    actorProfileId: string
    action: 'owner' | 'moderator' | 'connection' | 'requested' | 'blocked' | 'remove' | 'demote' | 'transfer'
    updatedAt: number
  }): Promise<void> {
    await this.data.changeCommunityRelationship!(change)
  }

  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ACCOUNT_NOT_FOUND')) {
      throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    }
    if (message.includes('PROFILE_NOT_OWNED')) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    if (message.includes('PROFILE_TYPE_MISMATCH')) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
    if (message.includes('PROFILE_NOT_FOUND')) {
      throw new NotFoundException('PROFILE_NOT_FOUND')
    }
    if (message.includes('COMMUNITY_STAFF_REQUIRED')) {
      throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    }
    if (message.includes('INVALID_MEMBER_TAB')) {
      throw new BadRequestException('INVALID_MEMBER_TAB')
    }
    if (message.includes('COMMUNITY_NOT_FOUND')) {
      throw new NotFoundException('COMMUNITY_NOT_FOUND')
    }
    if (message.includes('COMMUNITY_ACTION_NOT_ALLOWED')) {
      throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')
    }
    if (message.includes('ONLY_OWNER_CAN_DEMOTE_MODERATOR')) {
      throw new ForbiddenException('ONLY_OWNER_CAN_DEMOTE_MODERATOR')
    }
    if (message.includes('OWNERSHIP_TRANSFER_NOT_ALLOWED')) {
      throw new ForbiddenException('OWNERSHIP_TRANSFER_NOT_ALLOWED')
    }
    throw error
  }
}
