import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
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
    return this.data.transaction<Relationship[]>(
      ['accounts', 'profiles', 'relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        this.access.assertOwnsInRecords(userId, profileId, accounts, profiles)
        const relationships = collections.relationships as Relationship[]
        return {
          records: collections,
          result: relationships.filter(record => record.profiles.includes(profileId))
        }
      }
    )
  }
  async getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.data.transaction<PaginatedResult<Profile>>(
      ['profiles', 'relationships'],
      collections => {
        const profiles = collections.profiles as Profile[]
        const profile = profiles.find(item => item.id === profileId)
        if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
        const friendIds = new Set(
          (collections.relationships as Relationship[])
            .filter(record => record.type === 'connection' && record.profiles.includes(profileId))
            .map(record => record.profiles.find(id => id !== profileId)!)
        )
        const friends = profiles
          .filter(friend => friendIds.has(friend.id) && friend.type === profile.type)
          .map(friend => ({ ...friend, about: sanitizeRichText(friend.about ?? '') }))
        return { records: collections, result: paginate(friends, q) }
      }
    )
  }

  async updateProfileRelationship(userId: string, source: string, target: string, type: RelationshipType): Promise<Relationship> {
    const now = Date.now()
    return this.data.transaction<Relationship>(
      ['accounts', 'profiles', 'relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const all = collections.relationships as Relationship[]
        this.access.assertOwnsInRecords(userId, source, accounts, profiles)
        if (!source || !target || source === target) {
          throw new ForbiddenException('INVALID_RELATIONSHIP_PARTICIPANTS')
        }
        this.access.assertSameType(
          profiles.find(profile => profile.id === source),
          profiles.find(profile => profile.id === target)
        )

        const pair = [source, target].sort() as [string, string]
        const current = all.find(record =>
          record.profiles[0] === pair[0] && record.profiles[1] === pair[1]
        )
        if (type === 'requested' && current) {
          throw new ConflictException('RELATIONSHIP_ALREADY_EXISTS')
        }
        if (type === 'connection' && (
          current?.type !== 'requested' || current.requestedBy === source
        )) {
          throw new ForbiddenException('ONLY_RECIPIENT_CAN_ACCEPT_REQUEST')
        }

        const next: Relationship = {
          profiles: pair,
          type,
          requestedBy: type === 'requested' ? source : null,
          blockedBy: type === 'blocked' ? source : null,
          updatedAt: now
        }
        return {
          records: {
            ...collections,
            relationships: [
              ...all.filter(record =>
                record.profiles[0] !== pair[0] || record.profiles[1] !== pair[1]
              ),
              next
            ]
          },
          result: next
        }
      }
    )
  }

  async removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    const pair = [source, target].sort()
    await this.data.transaction(
      ['accounts', 'profiles', 'relationships'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const all = collections.relationships as Relationship[]
        this.access.assertOwnsInRecords(userId, source, accounts, profiles)
        this.access.assertSameType(
          profiles.find(profile => profile.id === source),
          profiles.find(profile => profile.id === target)
        )

        const current = all.find(record =>
          record.profiles[0] === pair[0] && record.profiles[1] === pair[1]
        )
        if (current?.type === 'blocked' && current.blockedBy && current.blockedBy !== source) {
          throw new ForbiddenException('ONLY_BLOCKER_CAN_UNBLOCK')
        }
        return {
          records: {
            ...collections,
            relationships: all.filter(record =>
              record.profiles[0] !== pair[0] || record.profiles[1] !== pair[1]
            )
          },
          result: undefined
        }
      }
    )
  }
}
