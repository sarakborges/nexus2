import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import type {
  PaginatedResult,
  Profile,
  Relationship,
  RelationshipType
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { DomainAccessService } from './domain-access.service'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ProfileRelationshipService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService
  ) {}

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    try {
      return await this.data.getProfileRelationships(userId, profileId)
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }
  async getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    try {
      const result = await this.data.getProfileFriends(profileId, q.page)
      return {
        ...result,
        items: result.items.map(friend => ({
          ...friend,
          about: sanitizeRichText(friend.about ?? '')
        }))
      }
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async updateProfileRelationship(userId: string, source: string, target: string, type: RelationshipType): Promise<Relationship> {
    const now = Date.now()
    const pair = [source, target].sort() as [string, string]
    try {
      await this.data.upsertProfileRelationship({
        userId,
        sourceProfileId: source,
        targetProfileId: target,
        type,
        updatedAt: now
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
    return {
      profiles: pair,
      type,
      requestedBy: type === 'requested' ? source : null,
      blockedBy: type === 'blocked' ? source : null,
      updatedAt: now
    }

  }

  async removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    const pair = [source, target].sort()
    const lastActivity = Date.now()
    try {
      await this.data.removeProfileRelationship({
        userId,
        sourceProfileId: source,
        targetProfileId: target,
        updatedAt: lastActivity
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
    return

  }

  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('PROFILE_NOT_OWNED')) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    if (message.includes('PROFILE_TYPE_MISMATCH')) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
    if (message.includes('PROFILE_NOT_FOUND')) {
      throw new NotFoundException('PROFILE_NOT_FOUND')
    }
    if (message.includes('INVALID_RELATIONSHIP_PARTICIPANTS')) {
      throw new ForbiddenException('INVALID_RELATIONSHIP_PARTICIPANTS')
    }
    if (message.includes('RELATIONSHIP_ALREADY_EXISTS')) {
      throw new ConflictException('RELATIONSHIP_ALREADY_EXISTS')
    }
    if (message.includes('ONLY_RECIPIENT_CAN_ACCEPT_REQUEST')) {
      throw new ForbiddenException('ONLY_RECIPIENT_CAN_ACCEPT_REQUEST')
    }
    if (message.includes('ONLY_BLOCKER_CAN_UNBLOCK')) {
      throw new ForbiddenException('ONLY_BLOCKER_CAN_UNBLOCK')
    }
    throw error
  }
}
