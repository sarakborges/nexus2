import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  Community, CommunityRelationship, CommunityRelationshipType, CreateCommunityInput,
  CreateProfileInput, PaginatedResult, Profile, ProfileMessage, RecentActivity, Relationship, RelationshipType
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import { paginate, type PaginationDto } from '../pagination/pagination.dto'

@Injectable()
export class DomainService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService
  ) {}

  async listProfiles(q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return paginate(await this.data.read<Profile>('profiles'), q)
  }
  async listOwnedProfiles(userId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    const user = await this.auth.getUser(userId)
    return paginate((await this.data.read<Profile>('profiles')).filter(p => user.profiles.includes(p.id)), q)
  }
  async getProfile(url: string): Promise<Profile> {
    const value = this.normalize(url)
    const found = (await this.data.read<Profile>('profiles')).find(p => p.url === value)
    if (!found) throw new NotFoundException('PROFILE_NOT_FOUND')
    return found
  }
  async getProfilesByIds(ids: string[]): Promise<Profile[]> {
    const set = new Set(ids)
    return (await this.data.read<Profile>('profiles')).filter(p => set.has(p.id))
  }
  async createProfile(userId: string, input: CreateProfileInput): Promise<Profile> {
    const name = input.name.trim()
    const url = this.normalize(input.url)
    const picture = input.picture.trim()
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['social', 'rp', 'business'].includes(input.type) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    const profiles = await this.data.read<Profile>('profiles')
    if (profiles.some(p => p.url === url)) throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
    const profile: Profile = { id: randomUUID(), name, url, picture, about: input.about.trim(), type: input.type }
    await this.data.write('profiles', [...profiles, profile])
    try { await this.auth.addProfile(userId, profile.id) }
    catch (error) { await this.data.write('profiles', profiles); throw error }
    return profile
  }

  async listCommunities(q: PaginationDto): Promise<PaginatedResult<Community>> {
    return paginate(await this.data.read<Community>('communities'), q)
  }
  async getCommunity(url: string): Promise<Community> {
    const found = (await this.data.read<Community>('communities')).find(c => c.url === this.normalize(url))
    if (!found) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    return found
  }
  async getCommunitiesByIds(ids: string[]): Promise<Community[]> {
    const set = new Set(ids)
    return (await this.data.read<Community>('communities')).filter(c => set.has(c.id))
  }
  async listProfileCommunities(profileId: string, q: PaginationDto): Promise<PaginatedResult<Community>> {
    const links = await this.data.read<CommunityRelationship>('community_relationships')
    const ids = links.filter(r => r.profiles[0] === profileId && ['owner', 'moderator', 'connection'].includes(r.type)).map(r => r.profiles[1])
    return paginate(await this.getCommunitiesByIds(ids), q)
  }
  async createCommunity(userId: string, ownerProfileId: string, input: CreateCommunityInput): Promise<Community> {
    if (!await this.auth.ownsProfile(userId, ownerProfileId)) throw new ForbiddenException('OWNER_PROFILE_REQUIRED')
    const name = input.name.trim()
    const url = this.normalize(input.url)
    const picture = input.picture.trim()
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['social', 'rp', 'business'].includes(input.type) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
    const communities = await this.data.read<Community>('communities')
    if (communities.some(c => c.url === url)) throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
    const community: Community = { id: randomUUID(), name, url, picture, about: input.about.trim(), type: input.type }
    const links = await this.data.read<CommunityRelationship>('community_relationships')
    await this.data.write('communities', [...communities, community])
    try {
      await this.data.write('community_relationships', [...links, {
        profiles: [ownerProfileId, community.id], type: 'owner',
        requestedBy: null, blockedBy: null, updatedAt: Date.now()
      }])
    } catch (error) { await this.data.write('communities', communities); throw error }
    return community
  }

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    await this.assertOwns(userId, profileId)
    return (await this.data.read<Relationship>('relationships')).filter(r => r.profiles.includes(profileId))
  }
  async getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    const relations = await this.data.read<Relationship>('relationships')
    const ids = relations.filter(r => r.type === 'connection' && r.profiles.includes(profileId))
      .map(r => r.profiles.find(id => id !== profileId)!)
    return paginate(await this.getProfilesByIds(ids), q)
  }

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    const user = await this.auth.getUser(userId)
    const ownedProfileIds = new Set(user.profiles)
    if (!ownedProfileIds.size) return []

    const [profiles, communities, relationships, communityRelationships] = await Promise.all([
      this.data.read<Profile>('profiles'),
      this.data.read<Community>('communities'),
      this.data.read<Relationship>('relationships'),
      this.data.read<CommunityRelationship>('community_relationships')
    ])
    const profilesById = new Map(profiles.map(profile => [profile.id, profile] as const))
    const communitiesById = new Map(communities.map(community => [community.id, community] as const))
    const activities: RecentActivity[] = []

    for (const relationship of relationships) {
      if (relationship.type !== 'connection') continue
      const ownedParticipants = relationship.profiles.filter(id => ownedProfileIds.has(id))
      if (ownedParticipants.length !== 1) continue
      const profile = profilesById.get(ownedParticipants[0])
      const friendId = relationship.profiles.find(id => id !== ownedParticipants[0])
      const friend = friendId ? profilesById.get(friendId) : undefined
      if (!profile || !friend) continue
      activities.push({
        id: `friend:${relationship.profiles[0]}:${relationship.profiles[1]}`,
        type: 'friend_connected',
        updatedAt: relationship.updatedAt,
        profile,
        friend
      })
    }

    for (const relationship of communityRelationships) {
      if (!ownedProfileIds.has(relationship.profiles[0])) continue
      if (relationship.type !== 'owner' && relationship.type !== 'moderator' && relationship.type !== 'connection') continue
      const profile = profilesById.get(relationship.profiles[0])
      const community = communitiesById.get(relationship.profiles[1])
      if (!profile || !community) continue
      activities.push({
        id: `community:${profile.id}:${community.id}`,
        type: 'community_membership',
        updatedAt: relationship.updatedAt,
        profile,
        community,
        role: relationship.type
      })
    }

    return activities
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
      .slice(0, 10)
  }

  async updateProfileRelationship(userId: string, source: string, target: string, type: RelationshipType): Promise<Relationship> {
    await this.assertOwns(userId, source)
    if (!source || !target || source === target) throw new ForbiddenException('INVALID_RELATIONSHIP_PARTICIPANTS')
    const all = await this.data.read<Relationship>('relationships')
    const pair = [source, target].sort() as [string, string]
    const current = all.find(r => r.profiles[0] === pair[0] && r.profiles[1] === pair[1])
    if (type === 'requested' && current) throw new ConflictException('RELATIONSHIP_ALREADY_EXISTS')
    if (type === 'connection' && (current?.type !== 'requested' || current.requestedBy === source)) {
      throw new ForbiddenException('ONLY_RECIPIENT_CAN_ACCEPT_REQUEST')
    }
    const value: Relationship = {
      profiles: pair, type, requestedBy: type === 'requested' ? source : null,
      blockedBy: type === 'blocked' ? source : null, updatedAt: Date.now()
    }
    await this.data.write('relationships', [...all.filter(r => r.profiles[0] !== pair[0] || r.profiles[1] !== pair[1]), value])
    return value
  }
  async removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    await this.assertOwns(userId, source)
    const all = await this.data.read<Relationship>('relationships')
    const pair = [source, target].sort()
    const current = all.find(r => r.profiles[0] === pair[0] && r.profiles[1] === pair[1])
    if (current?.type === 'blocked' && current.blockedBy && current.blockedBy !== source) {
      throw new ForbiddenException('ONLY_BLOCKER_CAN_UNBLOCK')
    }
    await this.data.write('relationships', all.filter(r => r.profiles[0] !== pair[0] || r.profiles[1] !== pair[1]))
  }

  async getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    await this.ensureCommunity(communityId)
    if (!userId) return []
    const user = await this.auth.getUser(userId)
    const ownedProfileIds = new Set(user.profiles)
    const records = await this.readCommunityRelationships(communityId)
    return records.filter(record => ownedProfileIds.has(record.profiles[0]))
  }

  async listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.ensureCommunity(communityId)
    if (!['all', 'staff', 'banned'].includes(tab)) throw new BadRequestException('INVALID_MEMBER_TAB')
    if (tab !== 'all') {
      if (!userId || !actorProfileId) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
      await this.assertOwns(userId, actorProfileId)
      await this.assertStaff(actorProfileId, communityId)
    }
    const records = await this.readCommunityRelationships(communityId)
    const types = tab === 'staff' ? ['owner', 'moderator'] : tab === 'banned' ? ['blocked'] : ['owner', 'moderator', 'connection']
    const matching = records.filter(r => types.includes(r.type))
    const byId = new Map(matching.map(r => [r.profiles[0], r.type]))
    const profiles = await this.data.read<Profile>('profiles')
    return paginate(profiles.filter(p => byId.has(p.id)).map(p => ({ ...p, role: byId.get(p.id)! })), q)
  }
  async listPendingMembers(userId: string, communityId: string, actorProfileId: string, q: PaginationDto): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.assertOwns(userId, actorProfileId)
    await this.assertStaff(actorProfileId, communityId)
    const records = (await this.readCommunityRelationships(communityId)).filter(r => r.type === 'requested')
    const ids = new Set(records.map(r => r.profiles[0]))
    const profiles = await this.data.read<Profile>('profiles')
    return paginate(profiles.filter(p => ids.has(p.id)).map(p => ({ ...p, role: 'requested' })), q)
  }
  async updateCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string, type: CommunityRelationshipType): Promise<CommunityRelationship> {
    await this.assertOwns(userId, actorId)
    await this.ensureCommunity(communityId)
    const records = await this.readCommunityRelationships(communityId)
    const actorRole = this.role(actorId, records)
    const targetRole = this.role(targetId, records)
    const self = actorId === targetId
    let allowed = false
    if (type === 'requested') allowed = self && targetRole === null
    if (type === 'connection') allowed = (actorRole === 'owner' || actorRole === 'moderator') && targetRole === 'requested'
    if (type === 'moderator') allowed = actorRole === 'owner' && targetRole === 'connection'
    if (type === 'blocked') allowed = (self && (targetRole === null || targetRole === 'connection')) || ((actorRole === 'owner' || actorRole === 'moderator') && targetRole === 'connection')
    if (!allowed) throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')
    const record: CommunityRelationship = {
      profiles: [targetId, communityId], type,
      requestedBy: type === 'requested' ? actorId : null,
      blockedBy: type === 'blocked' ? actorId : null, updatedAt: Date.now()
    }
    const rest = (await this.data.read<CommunityRelationship>('community_relationships'))
      .filter(r => r.profiles[0] !== targetId || r.profiles[1] !== communityId)
    await this.data.write('community_relationships', [...rest, record])
    return record
  }
  async removeCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    await this.assertOwns(userId, actorId)
    await this.ensureCommunity(communityId)
    const all = await this.data.read<CommunityRelationship>('community_relationships')
    const target = all.find(r => r.profiles[0] === targetId && r.profiles[1] === communityId)
    if (!target) return
    const actorRole = this.role(actorId, all.filter(r => r.profiles[1] === communityId))
    const self = actorId === targetId
    const canSelf = self && (['connection', 'requested'].includes(target.type) || (target.type === 'blocked' && (target.blockedBy === actorId || target.blockedBy === null)))
    const canStaff = ['owner', 'moderator'].includes(actorRole ?? '') &&
      ['connection', 'requested', 'blocked'].includes(target.type) &&
      !(actorRole === 'moderator' && target.type === 'moderator')
    if (!canSelf && !canStaff) throw new ForbiddenException('COMMUNITY_ACTION_NOT_ALLOWED')
    await this.data.write('community_relationships', all.filter(r => r.profiles[0] !== targetId || r.profiles[1] !== communityId))
  }
  async demoteModerator(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    await this.assertOwns(userId, actorId)
    const all = await this.data.read<CommunityRelationship>('community_relationships')
    const filtered = all.filter(r => r.profiles[1] === communityId)
    if (this.role(actorId, filtered) !== 'owner' || this.role(targetId, filtered) !== 'moderator') throw new ForbiddenException('ONLY_OWNER_CAN_DEMOTE_MODERATOR')
    await this.data.write('community_relationships', all.map(r => r.profiles[0] === targetId && r.profiles[1] === communityId ? { ...r, type: 'connection', updatedAt: Date.now() } : r))
  }
  async transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    await this.assertOwns(userId, actorId)
    const all = await this.data.read<CommunityRelationship>('community_relationships')
    const filtered = all.filter(r => r.profiles[1] === communityId)
    if (this.role(actorId, filtered) !== 'owner' || this.role(newOwnerId, filtered) !== 'moderator') throw new ForbiddenException('OWNERSHIP_TRANSFER_NOT_ALLOWED')
    await this.data.write('community_relationships', all.map(r => {
      if (r.profiles[1] !== communityId) return r
      if (r.profiles[0] === actorId) return { ...r, type: 'moderator', updatedAt: Date.now() }
      if (r.profiles[0] === newOwnerId) return { ...r, type: 'owner', updatedAt: Date.now() }
      return r
    }))
  }

  async getMessages(profileId: string, userId: string | null, q: PaginationDto): Promise<PaginatedResult<ProfileMessage>> {
    const messages = await this.data.read<ProfileMessage>('profile_messages')
    const viewerProfiles = userId ? (await this.auth.getUser(userId)).profiles : []
    const own = viewerProfiles.includes(profileId)
    const visible = messages.filter(m => m.toProfileId === profileId && (own || viewerProfiles.includes(m.fromProfileId)))
      .sort((a, b) => b.createdAt - a.createdAt)
    return paginate(visible, q)
  }
  async sendMessage(userId: string, fromProfileId: string, toProfileId: string, content: string): Promise<ProfileMessage> {
    await this.assertOwns(userId, fromProfileId)
    const normalized = content.trim()
    if (!normalized || normalized.length > 4000) throw new ConflictException('INVALID_MESSAGE')
    if (!(await this.data.read<Profile>('profiles')).some(p => p.id === toProfileId)) throw new NotFoundException('RECIPIENT_PROFILE_NOT_FOUND')
    const all = await this.data.read<ProfileMessage>('profile_messages')
    const message: ProfileMessage = { id: randomUUID(), fromProfileId, toProfileId, content: normalized, createdAt: Date.now() }
    await this.data.write('profile_messages', [...all, message])
    return message
  }

  private async readCommunityRelationships(communityId: string): Promise<CommunityRelationship[]> {
    return (await this.data.read<CommunityRelationship>('community_relationships'))
      .filter(record => record.profiles[1] === communityId)
  }
  private async assertOwns(userId: string, profileId: string): Promise<void> {
    if (!await this.auth.ownsProfile(userId, profileId)) throw new ForbiddenException('PROFILE_NOT_OWNED')
  }
  private async ensureCommunity(id: string): Promise<void> {
    if (!(await this.data.read<Community>('communities')).some(c => c.id === id)) throw new NotFoundException('COMMUNITY_NOT_FOUND')
  }
  private async assertStaff(profileId: string, communityId: string): Promise<void> {
    const records = await this.readCommunityRelationships(communityId)
    if (!['owner', 'moderator'].includes(this.role(profileId, records) ?? '')) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
  }
  private role(profileId: string, records: CommunityRelationship[]): CommunityRelationshipType | null {
    return records.find(r => r.profiles[0] === profileId)?.type ?? null
  }
  private normalize(value: string): string { return value.trim().replace(/^@/, '').toLowerCase() }
}
