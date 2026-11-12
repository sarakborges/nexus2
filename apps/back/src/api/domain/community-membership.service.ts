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
    if (this.data.getCommunityRelationships) {
      try {
        return await this.data.getCommunityRelationships(userId, communityId)
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
    }
    return this.data.transaction<CommunityRelationship[]>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const community = normalized.communities.find(item => item.id === communityId)
        if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        if (!userId) return { records, result: [] }
        const account = (records.accounts as AccountRecord[]).find(item => item.id === userId)
        if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const profiles = records.profiles as Profile[]
        const relationships = records.community_relationships as CommunityRelationship[]
        const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
        const ownedProfileIds = new Set(account.profiles)
        const visible = relationships.filter(record =>
          record.profiles[1] === communityId &&
          ownedProfileIds.has(record.profiles[0]) &&
          profileTypes.get(record.profiles[0]) === community.type
        )
        return { records, result: visible }
      }
    )
  }
  async listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMemberProfile>> {
    if (this.data.listCommunityMembers) {
      try {
        return await this.data.listCommunityMembers(
          communityId, tab, q.page, userId, actorProfileId
        )
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
    }
    return this.data.transaction<PaginatedResult<CommunityMemberProfile>>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const accounts = records.accounts as AccountRecord[]
        const profiles = records.profiles as Profile[]
        const relationships = records.community_relationships as CommunityRelationship[]
        this.access.assertCommunityReadableInRecords(
          communityId, userId, accounts, normalized.communities, relationships
        )
        if (!['all', 'staff', 'banned'].includes(tab)) throw new BadRequestException('INVALID_MEMBER_TAB')
        if (tab !== 'all') {
          if (!userId || !actorProfileId) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
          const context = this.access.assertCommunityProfileInRecords(
            userId, actorProfileId, communityId, accounts, profiles, normalized.communities, relationships,
            { allowDifferentActiveType: true }
          )
          if (!['owner', 'moderator'].includes(context.role ?? '')) {
            throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
          }
        }
        const community = normalized.communities.find(item => item.id === communityId)!
        const types = tab === 'staff' ? ['owner', 'moderator'] :
          tab === 'banned' ? ['blocked'] : ['owner', 'moderator', 'connection']
        const roleByProfile = new Map(
          relationships
            .filter(record => record.profiles[1] === communityId && types.includes(record.type))
            .map(record => [record.profiles[0], record.type] as const)
        )
        const result = paginate(
          profiles
            .filter(profile => roleByProfile.has(profile.id) && profile.type === community.type)
            .map(profile => ({ ...profile, role: roleByProfile.get(profile.id)! })),
          q
        )
        return { records, result }
      }
    )
  }

  async listPendingMembers(userId: string, communityId: string, actorProfileId: string, q: PaginationDto): Promise<PaginatedResult<CommunityMemberProfile>> {
    if (this.data.listPendingMembers) {
      try {
        return await this.data.listPendingMembers(userId, communityId, actorProfileId, q.page)
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
    }
    return this.data.transaction<PaginatedResult<CommunityMemberProfile>>(
      ['accounts', 'profiles', 'communities', 'community_relationships'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        const accounts = records.accounts as AccountRecord[]
        const profiles = records.profiles as Profile[]
        const relationships = records.community_relationships as CommunityRelationship[]
        const context = this.access.assertCommunityProfileInRecords(
          userId, actorProfileId, communityId, accounts, profiles, normalized.communities, relationships,
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
        return { records, result }
      }
    )
  }
  async updateCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string, type: CommunityRelationshipType): Promise<CommunityRelationship> {
    const now = Date.now()
    if (this.data.changeCommunityRelationship) {
      try {
        await this.changeRelationship({
          userId, communityId, targetProfileId: targetId, actorProfileId: actorId,
          action: type, updatedAt: now
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
            profiles: this.access.touchProfilesActivity(profiles, [actorId, targetId], now),
            communities: this.access.touchCommunityActivity(communities, communityId, now),
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
    const now = Date.now()
    if (this.data.changeCommunityRelationship) {
      try {
        await this.changeRelationship({
          userId, communityId, targetProfileId: targetId, actorProfileId: actorId,
          action: 'remove', updatedAt: now
        })
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
      return
    }
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
            profiles: this.access.touchProfilesActivity(profiles, [actorId, targetId], now),
            communities: this.access.touchCommunityActivity(communities, communityId, now),
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
    if (this.data.changeCommunityRelationship) {
      try {
        await this.changeRelationship({
          userId, communityId, targetProfileId: targetId, actorProfileId: actorId,
          action: 'demote', updatedAt: now
        })
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
      return
    }
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
            profiles: this.access.touchProfilesActivity(profiles, [actorId, targetId], now),
            communities: this.access.touchCommunityActivity(communities, communityId, now),
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
    if (this.data.changeCommunityRelationship) {
      try {
        await this.changeRelationship({
          userId, communityId, targetProfileId: newOwnerId, actorProfileId: actorId,
          action: 'transfer', updatedAt: now
        })
      } catch (error) {
        this.throwRelationalWriteError(error)
      }
      return
    }
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
            profiles: this.access.touchProfilesActivity(profiles, [actorId, newOwnerId], now),
            communities: this.access.touchCommunityActivity(communities, communityId, now),
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
