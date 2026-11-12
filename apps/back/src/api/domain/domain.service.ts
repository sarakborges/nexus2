import { Inject, Injectable, Optional } from '@nestjs/common'
import type {
  ActivityFeedCursor,
  ActivityFeedPage,
  Community,
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicDetail,
  CommunityForumTopicSummary,
  CommunityRelationship,
  CommunityRelationshipType,
  CreateCommunityInput,
  CreateProfileInput,
  CreateProfileResult,
  PaginatedResult,
  Profile,
  ProfileMessage,
  RecentActivity,
  Relationship,
  RelationshipType,
  SearchResultItem,
  SearchScope
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { CommunityMemberProfile, ForumTopicModerationChanges } from './domain.types'
import { AuthService } from '../auth/auth.service'
import { PaginationDto } from '../pagination/pagination.dto'
import { paginate } from '../pagination/pagination.helper'
import { filterAndSortList } from '../pagination/list-query.helper'
import { getRichTextPlainText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import { ActivityService } from './activity.service'
import { CommunityForumService } from './community-forum.service'
import { CommunityService } from './community.service'
import { DomainAccessService } from './domain-access.service'
import { ProfileMessageService } from './profile-message.service'
import { ProfileService } from './profile.service'

@Injectable()
export class DomainService {
  private readonly profiles: ProfileService
  private readonly communities: CommunityService
  private readonly forum: CommunityForumService
  private readonly messages: ProfileMessageService
  private readonly activity: ActivityService
  private readonly data: DataRepository
  private readonly access: DomainAccessService

  constructor(
    @Inject(DATA_REPOSITORY) data: DataRepository,
    auth: AuthService,
    @Optional() uploads?: UploadsService,
    @Optional() access?: DomainAccessService,
    @Optional() profiles?: ProfileService,
    @Optional() communities?: CommunityService,
    @Optional() forum?: CommunityForumService,
    @Optional() messages?: ProfileMessageService,
    @Optional() activity?: ActivityService
  ) {
    this.data = data
    const domainAccess = access ?? new DomainAccessService(data)
    this.access = domainAccess
    this.profiles = profiles ?? new ProfileService(data, auth, domainAccess, uploads)
    this.communities = communities ?? new CommunityService(data, auth, domainAccess, uploads)
    this.forum = forum ?? new CommunityForumService(data, domainAccess, uploads)
    this.messages = messages ?? new ProfileMessageService(data, domainAccess, uploads)
    this.activity = activity ?? new ActivityService(data, domainAccess)
  }

  async searchEntities(
    query: string,
    scope: SearchScope,
    q: PaginationDto
  ): Promise<PaginatedResult<SearchResultItem>> {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return paginate([], q)
    return this.data.searchEntities(normalizedQuery, scope, q.page, q.sort)
  }

  listProfiles(q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.profiles.listProfiles(q)
  }

  listOwnedProfiles(userId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.profiles.listOwnedProfiles(userId, q)
  }

  getProfile(url: string): Promise<Profile> {
    return this.profiles.getProfile(url)
  }

  getProfilesByIds(ids: string[]): Promise<Profile[]> {
    return this.profiles.getProfilesByIds(ids)
  }

  createProfile(userId: string, input: CreateProfileInput): Promise<CreateProfileResult> {
    return this.profiles.createProfile(userId, input)
  }

  updateProfile(userId: string, profileId: string, input: Omit<CreateProfileInput, 'type'>): Promise<Profile> {
    return this.profiles.updateProfile(userId, profileId, input)
  }

  listCommunities(q: PaginationDto): Promise<PaginatedResult<Community>> {
    return this.communities.listCommunities(q)
  }

  getCommunity(url: string, userId: string | null = null): Promise<Community> {
    return this.communities.getCommunity(url, userId)
  }

  getCommunitiesByIds(ids: string[]): Promise<Community[]> {
    return this.communities.getCommunitiesByIds(ids)
  }

  listProfileCommunities(profileId: string, q: PaginationDto): Promise<PaginatedResult<Community>> {
    return this.communities.listProfileCommunities(profileId, q)
  }

  createCommunity(userId: string, ownerProfileId: string, input: CreateCommunityInput): Promise<Community> {
    return this.communities.createCommunity(userId, ownerProfileId, input)
  }

  updateCommunity(userId: string, communityId: string, input: CreateCommunityInput): Promise<Community> {
    return this.communities.updateCommunity(userId, communityId, input)
  }

  getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    return this.profiles.getProfileRelationships(userId, profileId)
  }

  getProfileFriends(profileId: string, q: PaginationDto): Promise<PaginatedResult<Profile>> {
    return this.profiles.getProfileFriends(profileId, q)
  }

  updateProfileRelationship(userId: string, source: string, target: string, type: RelationshipType): Promise<Relationship> {
    return this.profiles.updateProfileRelationship(userId, source, target, type)
  }

  removeProfileRelationship(userId: string, source: string, target: string): Promise<void> {
    return this.profiles.removeProfileRelationship(userId, source, target)
  }

  getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    return this.communities.getCommunityRelationships(userId, communityId)
  }

  listCommunityMembers(
    communityId: string,
    tab: string,
    q: PaginationDto,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMemberProfile>> {
    return this.communities.listCommunityMembers(communityId, tab, q, userId, actorProfileId)
  }

  listPendingMembers(
    userId: string,
    communityId: string,
    actorProfileId: string,
    q: PaginationDto
  ): Promise<PaginatedResult<CommunityMemberProfile>> {
    return this.communities.listPendingMembers(userId, communityId, actorProfileId, q)
  }

  updateCommunityRelationship(
    userId: string,
    communityId: string,
    targetId: string,
    actorId: string,
    type: CommunityRelationshipType
  ): Promise<CommunityRelationship> {
    return this.communities.updateCommunityRelationship(userId, communityId, targetId, actorId, type)
  }

  removeCommunityRelationship(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    return this.communities.removeCommunityRelationship(userId, communityId, targetId, actorId)
  }

  demoteModerator(userId: string, communityId: string, targetId: string, actorId: string): Promise<void> {
    return this.communities.demoteModerator(userId, communityId, targetId, actorId)
  }

  transferOwnership(userId: string, communityId: string, newOwnerId: string, actorId: string): Promise<void> {
    return this.communities.transferOwnership(userId, communityId, newOwnerId, actorId)
  }

  getRecentActivity(userId: string): Promise<RecentActivity[]> {
    return this.activity.getRecentActivity(userId)
  }

  getRecentActivityPage(
    userId: string,
    limit = 10,
    cursor: ActivityFeedCursor | null = null
  ): Promise<ActivityFeedPage> {
    return this.activity.getRecentActivityPage(userId, limit, cursor)
  }

  listCommunityForumTopics(
    communityId: string,
    q: PaginationDto,
    userId: string | null = null
  ): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    return this.forum.listCommunityForumTopics(communityId, q, userId)
  }

  getCommunityForumTopic(
    communityId: string,
    topicId: string,
    q: PaginationDto,
    userId: string | null = null
  ): Promise<CommunityForumTopicDetail> {
    return this.forum.getCommunityForumTopic(communityId, topicId, q, userId)
  }

  createCommunityForumTopic(
    userId: string,
    communityId: string,
    profileId: string,
    rawTitle: string,
    rawContent: string
  ): Promise<CommunityForumTopic> {
    return this.forum.createCommunityForumTopic(userId, communityId, profileId, rawTitle, rawContent)
  }

  createCommunityForumReply(
    userId: string,
    communityId: string,
    topicId: string,
    profileId: string,
    rawContent: string
  ): Promise<CommunityForumReply> {
    return this.forum.createCommunityForumReply(userId, communityId, topicId, profileId, rawContent)
  }

  moderateCommunityForumTopic(
    userId: string,
    communityId: string,
    topicId: string,
    profileId: string,
    changes: ForumTopicModerationChanges
  ): Promise<CommunityForumTopic> {
    return this.forum.moderateCommunityForumTopic(userId, communityId, topicId, profileId, changes)
  }

  deleteCommunityForumTopic(userId: string, communityId: string, topicId: string, actorProfileId: string): Promise<void> {
    return this.forum.deleteCommunityForumTopic(userId, communityId, topicId, actorProfileId)
  }

  deleteCommunityForumReply(userId: string, communityId: string, replyId: string, actorProfileId: string): Promise<void> {
    return this.forum.deleteCommunityForumReply(userId, communityId, replyId, actorProfileId)
  }

  getMessages(profileId: string, userId: string | null, q: PaginationDto): Promise<PaginatedResult<ProfileMessage>> {
    return this.messages.getMessages(profileId, userId, q)
  }

  sendMessage(userId: string, fromProfileId: string, toProfileId: string, content: string): Promise<ProfileMessage> {
    return this.messages.sendMessage(userId, fromProfileId, toProfileId, content)
  }

  deleteProfileMessage(userId: string, recipientProfileId: string, messageId: string, actorProfileId: string): Promise<void> {
    return this.messages.deleteMessage(userId, recipientProfileId, messageId, actorProfileId)
  }

  setProfileMessageFavorite(userId: string, recipientProfileId: string, messageId: string, actorProfileId: string, isFavorite: boolean): Promise<ProfileMessage> {
    return this.messages.setMessageFavorite(userId, recipientProfileId, messageId, actorProfileId, isFavorite)
  }
}
