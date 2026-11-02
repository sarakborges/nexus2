import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  Community, CommunityRelationship, CommunityRelationshipType, CreateCommunityInput,
  CreateProfileInput, PaginatedResult, Profile, ProfileMessage, RecentActivity, Relationship, RelationshipType,
  CommunityForumTopic, CommunityForumTopicSummary, CommunityForumReply, CommunityForumTopicDetail
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import { paginate, type PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'

@Injectable()
export class DomainService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async listProfiles(q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return paginate(await this.readProfiles(), q)
  }
  async listOwnedProfiles(userId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    const user = await this.auth.getUser(userId)
    return paginate((await this.readProfiles()).filter(p => user.profiles.includes(p.id)), q)
  }
  async getProfile(url: string): Promise<Profile> {
    const value = this.normalize(url)
    const found = (await this.readProfiles()).find(p => p.url === value)
    if (!found) throw new NotFoundException('PROFILE_NOT_FOUND')
    return found
  }
  async getProfilesByIds(ids: string[]): Promise<Profile[]> {
    const set = new Set(ids)
    return (await this.readProfiles()).filter(p => set.has(p.id))
  }
  async createProfile(userId: string, input: CreateProfileInput): Promise<Profile> {
    const name = input.name.trim()
    const url = this.normalize(input.url)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    await this.uploads?.validateAvatarUrl(userId, picture, 'profile-avatar')
    await this.uploads?.validateEditorImages(userId, about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      !['social', 'rp', 'business'].includes(input.type) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    const profiles = await this.readProfiles()
    if (profiles.some(p => p.url === url)) throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
    const profile: Profile = { id: randomUUID(), name, url, picture, about, type: input.type }
    await this.data.write('profiles', [...profiles, profile])
    try {
      await this.auth.addProfile(userId, profile.id)
      await this.uploads?.attachAvatarUrl(userId, picture, 'profile-avatar', 'profile', profile.id)
      await this.uploads?.attachEditorImages(userId, about, 'profile', profile.id)
    } catch (error) {
      await this.data.write('profiles', profiles)
      throw error
    }
    return profile
  }

  async updateProfile(userId: string, profileId: string, input: Omit<CreateProfileInput, 'type'>): Promise<Profile> {
    await this.assertOwns(userId, profileId)
    const profiles = await this.readProfiles()
    const current = profiles.find(profile => profile.id === profileId)
    if (!current) throw new NotFoundException('PROFILE_NOT_FOUND')

    const name = input.name.trim()
    const url = this.normalize(input.url)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_PROFILE')
    if (profiles.some(profile => profile.id !== profileId && profile.url === url)) {
      throw new ConflictException('PROFILE_URL_ALREADY_IN_USE')
    }

    if (picture !== current.picture) await this.uploads?.validateAvatarUrl(userId, picture, 'profile-avatar')
    const newEditorImages = this.getNewEditorImages(about, current.about)
    await this.uploads?.validateEditorImages(userId, newEditorImages)

    const updated: Profile = { ...current, name, url, picture, about }
    await this.data.write('profiles', profiles.map(profile => profile.id === profileId ? updated : profile))
    if (picture !== current.picture) {
      await this.uploads?.attachAvatarUrl(userId, picture, 'profile-avatar', 'profile', profileId)
    }
    if (newEditorImages) {
      await this.uploads?.attachEditorImages(userId, newEditorImages, 'profile', profileId)
    }
    return updated
  }

  async listCommunities(q: PaginationDto): Promise<PaginatedResult<Community>> {
    return paginate(await this.readCommunities(), q)
  }
  async getCommunity(url: string): Promise<Community> {
    const found = (await this.readCommunities()).find(c => c.url === this.normalize(url))
    if (!found) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    return found
  }
  async getCommunitiesByIds(ids: string[]): Promise<Community[]> {
    const set = new Set(ids)
    return (await this.readCommunities()).filter(c => set.has(c.id))
  }
  async listProfileCommunities(profileId: string, q: PaginationDto): Promise<PaginatedResult<Community>> {
    const profile = (await this.readProfiles()).find(item => item.id === profileId)
    if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const links = await this.data.read<CommunityRelationship>('community_relationships')
    const ids = new Set(links.filter(r => r.profiles[0] === profileId && ['owner', 'moderator', 'connection'].includes(r.type)).map(r => r.profiles[1]))
    return paginate((await this.readCommunities()).filter(community => ids.has(community.id) && community.type === profile.type), q)
  }
  async createCommunity(userId: string, ownerProfileId: string, input: CreateCommunityInput): Promise<Community> {
    await this.assertOwns(userId, ownerProfileId)
    const ownerProfile = (await this.readProfiles()).find(profile => profile.id === ownerProfileId)
    if (!ownerProfile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const name = input.name.trim()
    const url = this.normalize(input.url)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    await this.uploads?.validateAvatarUrl(userId, picture, 'community-avatar')
    await this.uploads?.validateEditorImages(userId, about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
    const communities = await this.readCommunities()
    if (communities.some(c => c.url === url)) throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
    const community: Community = { id: randomUUID(), name, url, picture, about, type: ownerProfile.type }
    const links = await this.data.read<CommunityRelationship>('community_relationships')
    await this.data.write('communities', [...communities, community])
    try {
      await this.data.write('community_relationships', [...links, {
        profiles: [ownerProfileId, community.id], type: 'owner',
        requestedBy: null, blockedBy: null, updatedAt: Date.now()
      }])
    } catch (error) { await this.data.write('communities', communities); throw error }
    await this.uploads?.attachAvatarUrl(userId, picture, 'community-avatar', 'community', community.id)
    await this.uploads?.attachEditorImages(userId, about, 'community', community.id)
    return community
  }

  async updateCommunity(userId: string, communityId: string, input: CreateCommunityInput): Promise<Community> {
    await this.ensureCommunity(communityId)
    const relationships = await this.readCommunityRelationships(communityId)
    const ownerProfileId = relationships.find(record => record.type === 'owner')?.profiles[0]
    if (!ownerProfileId) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    await this.assertOwns(userId, ownerProfileId)
    const ownerProfile = (await this.readProfiles()).find(profile => profile.id === ownerProfileId)
    if (!ownerProfile) throw new NotFoundException('PROFILE_NOT_FOUND')

    const communities = await this.readCommunities()
    const current = communities.find(community => community.id === communityId)
    if (!current) throw new NotFoundException('COMMUNITY_NOT_FOUND')

    const name = input.name.trim()
    const url = this.normalize(input.url)
    const picture = input.picture.trim()
    const about = sanitizeRichText(input.about)
    const aboutText = getRichTextPlainText(about)
    if (!name || about.length > 12000 || aboutText.length > 500 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url) ||
      (picture && !/^https?:\/\//i.test(picture))) throw new ConflictException('INVALID_COMMUNITY')
    if (communities.some(community => community.id !== communityId && community.url === url)) {
      throw new ConflictException('COMMUNITY_URL_ALREADY_IN_USE')
    }

    if (picture !== current.picture) await this.uploads?.validateAvatarUrl(userId, picture, 'community-avatar')
    const newEditorImages = this.getNewEditorImages(about, current.about)
    await this.uploads?.validateEditorImages(userId, newEditorImages)

    const updated: Community = { ...current, name, url, picture, about, type: ownerProfile.type }
    await this.data.write('communities', communities.map(community => community.id === communityId ? updated : community))
    if (picture !== current.picture) {
      await this.uploads?.attachAvatarUrl(userId, picture, 'community-avatar', 'community', communityId)
    }
    if (newEditorImages) {
      await this.uploads?.attachEditorImages(userId, newEditorImages, 'community', communityId)
    }
    return updated
  }

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    await this.assertOwns(userId, profileId)
    return (await this.data.read<Relationship>('relationships')).filter(r => r.profiles.includes(profileId))
  }
  async getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    const profile = (await this.readProfiles()).find(item => item.id === profileId)
    if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
    const relations = await this.data.read<Relationship>('relationships')
    const ids = relations.filter(r => r.type === 'connection' && r.profiles.includes(profileId))
      .map(r => r.profiles.find(id => id !== profileId)!)
    return paginate((await this.getProfilesByIds(ids)).filter(friend => friend.type === profile.type), q)
  }

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    const user = await this.auth.getUser(userId)
    const ownedProfileIds = new Set(user.profiles)
    if (!ownedProfileIds.size) return []

    const [profiles, communities, relationships, communityRelationships] = await Promise.all([
      this.readProfiles(),
      this.readCommunities(),
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
      if (!profile || !friend || profile.type !== friend.type) continue
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
      if (!profile || !community || profile.type !== community.type) continue
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
    const profiles = await this.readProfiles()
    this.assertSameType(profiles.find(profile => profile.id === source), profiles.find(profile => profile.id === target))
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
    const profiles = await this.readProfiles()
    this.assertSameType(profiles.find(profile => profile.id === source), profiles.find(profile => profile.id === target))
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
    const [records, community, profiles] = await Promise.all([
      this.readCommunityRelationships(communityId),
      this.readCommunities().then(items => items.find(item => item.id === communityId)),
      this.readProfiles()
    ])
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
    const currentProfileType = user.currentProfile
      ? profileTypes.get(user.currentProfile)
      : undefined
    if (currentProfileType && currentProfileType !== community.type) return []
    return records.filter(record => ownedProfileIds.has(record.profiles[0]) && profileTypes.get(record.profiles[0]) === community.type)
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
    const [profiles, community] = await Promise.all([this.readProfiles(), this.readCommunities().then(items => items.find(item => item.id === communityId))])
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    return paginate(profiles.filter(profile => byId.has(profile.id) && profile.type === community.type).map(profile => ({ ...profile, role: byId.get(profile.id)! })), q)
  }
  async listPendingMembers(userId: string, communityId: string, actorProfileId: string, q: PaginationDto): Promise<PaginatedResult<Profile & { role: string }>> {
    await this.assertOwns(userId, actorProfileId)
    await this.assertStaff(actorProfileId, communityId)
    const records = (await this.readCommunityRelationships(communityId)).filter(r => r.type === 'requested')
    const ids = new Set(records.map(r => r.profiles[0]))
    const [profiles, community] = await Promise.all([this.readProfiles(), this.readCommunities().then(items => items.find(item => item.id === communityId))])
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    return paginate(profiles.filter(profile => ids.has(profile.id) && profile.type === community.type).map(profile => ({ ...profile, role: 'requested' })), q)
  }
  async updateCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string, type: CommunityRelationshipType): Promise<CommunityRelationship> {
    await this.assertOwns(userId, actorId)
    await this.ensureCommunity(communityId)
    const records = await this.readCommunityRelationships(communityId)
    const community = (await this.readCommunities()).find(item => item.id === communityId)
    const profiles = await this.readProfiles()
    const actorProfile = profiles.find(profile => profile.id === actorId)
    const targetProfile = profiles.find(profile => profile.id === targetId)
    this.assertSameType(actorProfile, community)
    this.assertSameType(targetProfile, community)
    const actorRole = this.role(actorId, records)
    const targetRole = this.role(targetId, records)
    const self = actorId === targetId
    let allowed = false
    if (type === 'requested') allowed = self && targetRole === null
    if (type === 'connection') allowed = (actorRole === 'owner' || actorRole === 'moderator') && targetRole === 'requested'
    if (type === 'moderator') allowed = actorRole === 'owner' && targetRole === 'connection'
    if (type === 'blocked') allowed = !self && (actorRole === 'owner' || actorRole === 'moderator') && targetRole === 'connection'
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
    const [all, profiles, community] = await Promise.all([
      this.data.read<CommunityRelationship>('community_relationships'), this.readProfiles(),
      this.readCommunities().then(items => items.find(item => item.id === communityId))
    ])
    this.assertSameType(profiles.find(profile => profile.id === actorId), community)
    this.assertSameType(profiles.find(profile => profile.id === targetId), community)
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
    await this.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.readProfiles(), this.readCommunities()])
    const community = communities.find(item => item.id === communityId)
    this.assertSameType(profiles.find(profile => profile.id === actorId), community)
    this.assertSameType(profiles.find(profile => profile.id === targetId), community)
    const all = await this.data.read<CommunityRelationship>('community_relationships')
    const filtered = all.filter(r => r.profiles[1] === communityId)
    if (this.role(actorId, filtered) !== 'owner' || this.role(targetId, filtered) !== 'moderator') throw new ForbiddenException('ONLY_OWNER_CAN_DEMOTE_MODERATOR')
    await this.data.write('community_relationships', all.map(r => r.profiles[0] === targetId && r.profiles[1] === communityId ? { ...r, type: 'connection', updatedAt: Date.now() } : r))
  }
  async transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    await this.assertOwns(userId, actorId)
    await this.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.readProfiles(), this.readCommunities()])
    const community = communities.find(item => item.id === communityId)
    this.assertSameType(profiles.find(profile => profile.id === actorId), community)
    this.assertSameType(profiles.find(profile => profile.id === newOwnerId), community)
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


  async listCommunityForumTopics(communityId: string, q: PaginationDto): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    await this.ensureCommunity(communityId)
    const [topics, replies] = await Promise.all([this.data.read<CommunityForumTopic>('community_forum_topics'), this.data.read<CommunityForumReply>('community_forum_replies')])
    const replyCounts = new Map<string, number>()
    for (const reply of replies) replyCounts.set(reply.topicId, (replyCounts.get(reply.topicId) ?? 0) + 1)
    const visible = topics.filter(topic => topic.communityId === communityId)
      .map(topic => ({ ...topic, replyCount: replyCounts.get(topic.id) ?? 0 }))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    return paginate(visible, q)
  }

  async getCommunityForumTopic(communityId: string, topicId: string, q: PaginationDto): Promise<CommunityForumTopicDetail> {
    await this.ensureCommunity(communityId)
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    const replies = (await this.data.read<CommunityForumReply>('community_forum_replies'))
      .filter(reply => reply.topicId === topicId && reply.communityId === communityId)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    return { topic: { ...topic, replyCount: replies.length }, replies: paginate(replies, q) }
  }

  async createCommunityForumTopic(userId: string, communityId: string, profileId: string, rawTitle: string, rawContent: string): Promise<CommunityForumTopic> {
    await this.assertForumMember(userId, profileId, communityId)
    const title = rawTitle.trim().replace(/\s+/g, ' ')
    const content = sanitizeRichText(rawContent)
    const plainText = getRichTextPlainText(content)
    if (!title || title.length > 140 || !plainText || plainText.length > 8000 || content.length > 12000) throw new BadRequestException('INVALID_FORUM_TOPIC')
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const now = Date.now()
    const topic: CommunityForumTopic = { id: randomUUID(), communityId, profileId, title, content, createdAt: now, updatedAt: now, isPinned: false, isLocked: false }
    await this.data.write('community_forum_topics', [...topics, topic])
    return topic
  }

  async createCommunityForumReply(userId: string, communityId: string, topicId: string, profileId: string, rawContent: string): Promise<CommunityForumReply> {
    await this.assertForumMember(userId, profileId, communityId)
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    if (topic.isLocked) throw new ForbiddenException('FORUM_TOPIC_LOCKED')
    const content = sanitizeRichText(rawContent)
    const plainText = getRichTextPlainText(content)
    if (!plainText || plainText.length > 8000 || content.length > 12000) throw new BadRequestException('INVALID_FORUM_REPLY')
    const replies = await this.data.read<CommunityForumReply>('community_forum_replies')
    const now = Date.now()
    const reply: CommunityForumReply = { id: randomUUID(), topicId, communityId, profileId, content, createdAt: now, updatedAt: now }
    await this.data.write('community_forum_replies', [...replies, reply])
    await this.data.write('community_forum_topics', topics.map(record => record.id === topicId ? { ...record, updatedAt: now } : record))
    return reply
  }

  async moderateCommunityForumTopic(userId: string, communityId: string, topicId: string, profileId: string, changes: { isPinned?: boolean; isLocked?: boolean }): Promise<CommunityForumTopic> {
    await this.assertForumStaff(userId, profileId, communityId)
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    const updated: CommunityForumTopic = { ...topic, ...(typeof changes.isPinned === 'boolean' ? { isPinned: changes.isPinned } : {}), ...(typeof changes.isLocked === 'boolean' ? { isLocked: changes.isLocked } : {}), updatedAt: Date.now() }
    await this.data.write('community_forum_topics', topics.map(record => record.id === topicId ? updated : record))
    return updated
  }

  async deleteCommunityForumTopic(userId: string, communityId: string, topicId: string, actorProfileId: string): Promise<void> {
    await this.assertOwns(userId, actorProfileId)
    await this.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.readProfiles(), this.readCommunities()])
    this.assertSameType(profiles.find(profile => profile.id === actorProfileId), communities.find(community => community.id === communityId))
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    const role = this.role(actorProfileId, await this.readCommunityRelationships(communityId))
    if (topic.profileId !== actorProfileId && role !== 'owner' && role !== 'moderator') throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
    await this.data.write('community_forum_topics', topics.filter(record => record.id !== topicId))
    const replies = await this.data.read<CommunityForumReply>('community_forum_replies')
    await this.data.write('community_forum_replies', replies.filter(reply => reply.topicId !== topicId))
  }

  async deleteCommunityForumReply(userId: string, communityId: string, replyId: string, actorProfileId: string): Promise<void> {
    await this.assertOwns(userId, actorProfileId)
    await this.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.readProfiles(), this.readCommunities()])
    this.assertSameType(profiles.find(profile => profile.id === actorProfileId), communities.find(community => community.id === communityId))
    const replies = await this.data.read<CommunityForumReply>('community_forum_replies')
    const reply = replies.find(record => record.id === replyId && record.communityId === communityId)
    if (!reply) throw new NotFoundException('FORUM_REPLY_NOT_FOUND')
    const role = this.role(actorProfileId, await this.readCommunityRelationships(communityId))
    if (reply.profileId !== actorProfileId && role !== 'owner' && role !== 'moderator') throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
    await this.data.write('community_forum_replies', replies.filter(record => record.id !== replyId))
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    await this.data.write('community_forum_topics', topics.map(topic => topic.id === reply.topicId ? { ...topic, updatedAt: Date.now() } : topic))
  }

  async getMessages(profileId: string, userId: string | null, q: PaginationDto): Promise<PaginatedResult<ProfileMessage>> {
    const messages = await this.readMessages()
    const viewerProfiles = userId ? (await this.auth.getUser(userId)).profiles : []
    const own = viewerProfiles.includes(profileId)
    const visible = messages.filter(m => m.toProfileId === profileId && (own || viewerProfiles.includes(m.fromProfileId)))
      .sort((a, b) => b.createdAt - a.createdAt)
    return paginate(visible, q)
  }
  async sendMessage(userId: string, fromProfileId: string, toProfileId: string, content: string): Promise<ProfileMessage> {
    await this.assertOwns(userId, fromProfileId)
    const profiles = await this.readProfiles()
    this.assertSameType(profiles.find(profile => profile.id === fromProfileId), profiles.find(profile => profile.id === toProfileId))
    const normalized = sanitizeRichText(content)
    await this.uploads?.validateEditorImages(userId, normalized)
    const plainText = getRichTextPlainText(normalized)
    const hasImage = /<img\b/i.test(normalized)
    if ((!plainText && !hasImage) || plainText.length > 4000 || normalized.length > 12000) {
      throw new ConflictException('INVALID_MESSAGE')
    }
    if (!(await this.readProfiles()).some(p => p.id === toProfileId)) throw new NotFoundException('RECIPIENT_PROFILE_NOT_FOUND')
    const all = await this.readMessages()
    const message: ProfileMessage = { id: randomUUID(), fromProfileId, toProfileId, content: normalized, createdAt: Date.now() }
    await this.data.write('profile_messages', [...all, message])
    await this.uploads?.attachEditorImages(userId, normalized, 'profile-message', message.id, { fromProfileId, toProfileId })
    return message
  }


  private assertSameType(source?: Profile, target?: Profile | Community): void {
    if (!source || !target) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (source.type !== target.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
  }
  private async assertForumMember(userId: string, profileId: string, communityId: string): Promise<void> {
    await this.assertOwns(userId, profileId)
    await this.ensureCommunity(communityId)
    const [profiles, communities, records] = await Promise.all([this.readProfiles(), this.readCommunities(), this.readCommunityRelationships(communityId)])
    this.assertSameType(profiles.find(profile => profile.id === profileId), communities.find(item => item.id === communityId))
    if (!['owner', 'moderator', 'connection'].includes(this.role(profileId, records) ?? '')) throw new ForbiddenException('COMMUNITY_MEMBER_REQUIRED')
  }
  private async assertForumStaff(userId: string, profileId: string, communityId: string): Promise<void> {
    await this.assertOwns(userId, profileId)
    await this.ensureCommunity(communityId)
    const [profiles, communities, records] = await Promise.all([this.readProfiles(), this.readCommunities(), this.readCommunityRelationships(communityId)])
    this.assertSameType(profiles.find(profile => profile.id === profileId), communities.find(item => item.id === communityId))
    if (!['owner', 'moderator'].includes(this.role(profileId, records) ?? '')) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
  }
  private getNewEditorImages(html: string, previousHtml: string): string {
    const pattern = /<img\b[^>]*\bsrc=(["'])\/api\/uploads\/([0-9a-f-]{36})\/content\1/gi
    const previousIds = new Set([...previousHtml.matchAll(pattern)].map(match => match[2]))
    const newIds = [...html.matchAll(pattern)]
      .map(match => match[2])
      .filter((id, index, ids) => !previousIds.has(id) && ids.indexOf(id) === index)
    return newIds.map(id => '<img src="/api/uploads/' + id + '/content">').join('')
  }

  private async readProfiles(): Promise<Profile[]> {
    const profiles = await this.data.read<Profile>('profiles')
    return profiles.map(profile => ({
      ...profile,
      about: sanitizeRichText(profile.about ?? '')
    }))
  }

  private async readCommunities(): Promise<Community[]> {
    const [stored, profiles, relationships] = await Promise.all([
      this.data.read<Community>('communities'),
      this.readProfiles(),
      this.data.read<CommunityRelationship>('community_relationships')
    ])
    const profileTypes = new Map(profiles.map(profile => [profile.id, profile.type] as const))
    let hasTypeChanges = false
    const communities = stored.map(community => {
      const ownerProfileId = relationships.find(record =>
        record.profiles[1] === community.id && record.type === 'owner'
      )?.profiles[0]
      const inheritedType = ownerProfileId ? profileTypes.get(ownerProfileId) : undefined
      if (inheritedType && inheritedType !== community.type) hasTypeChanges = true
      return {
        ...community,
        ...(inheritedType ? { type: inheritedType } : {}),
        about: sanitizeRichText(community.about ?? '')
      }
    })
    if (hasTypeChanges) await this.data.write('communities', communities)
    return communities
  }

  private async readMessages(): Promise<ProfileMessage[]> {
    const messages = await this.data.read<ProfileMessage>('profile_messages')
    return messages.map(message => ({
      ...message,
      content: sanitizeRichText(message.content ?? '')
    }))
  }

  private async readCommunityRelationships(communityId: string): Promise<CommunityRelationship[]> {
    return (await this.data.read<CommunityRelationship>('community_relationships'))
      .filter(record => record.profiles[1] === communityId)
  }
  private async assertOwns(userId: string, profileId: string): Promise<void> {
    if (!await this.auth.ownsProfile(userId, profileId)) throw new ForbiddenException('PROFILE_NOT_OWNED')
    const user = await this.auth.getUser(userId)
    if (!user.currentProfile) return
    const profiles = await this.readProfiles()
    const currentProfile = profiles.find(profile => profile.id === user.currentProfile)
    const targetProfile = profiles.find(profile => profile.id === profileId)
    if (currentProfile && targetProfile && currentProfile.type !== targetProfile.type) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
  }
  private async ensureCommunity(id: string): Promise<void> {
    if (!(await this.readCommunities()).some(c => c.id === id)) throw new NotFoundException('COMMUNITY_NOT_FOUND')
  }
  private async assertStaff(profileId: string, communityId: string): Promise<void> {
    await this.ensureCommunity(communityId)
    const [profiles, communities, records] = await Promise.all([this.readProfiles(), this.readCommunities(), this.readCommunityRelationships(communityId)])
    this.assertSameType(profiles.find(profile => profile.id === profileId), communities.find(community => community.id === communityId))
    if (!['owner', 'moderator'].includes(this.role(profileId, records) ?? '')) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
  }
  private role(profileId: string, records: CommunityRelationship[]): CommunityRelationshipType | null {
    return records.find(r => r.profiles[0] === profileId)?.type ?? null
  }
  private normalize(value: string): string { return value.trim().replace(/^@/, '').toLowerCase() }
}
