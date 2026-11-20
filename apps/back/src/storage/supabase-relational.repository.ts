import type { DataRepository } from './repository.interface'
import { SupabaseAccountRepository } from './adapters/accounts.repository'
import { SupabaseMediaRepository } from './adapters/media.repository'
import { SupabaseProfilesRepository } from './adapters/profiles.repository'
import { SupabaseCommunitiesRepository } from './adapters/communities.repository'
import { SupabaseRelationshipsRepository } from './adapters/relationships.repository'
import { SupabaseProfileMessagesRepository } from './adapters/profileMessages.repository'
import { SupabaseCommunityForumRepository } from './adapters/communityForum.repository'
import { SupabaseActivityRepository } from './adapters/activity.repository'
import { SupabaseSearchRepository } from './adapters/search.repository'

/**
 * Stable aggregate facade for services that need the full persistence port.
 * Domain-specific Supabase operations live in their own adapters.
 */
export class SupabaseRelationalRepository implements DataRepository {
  private readonly accounts: SupabaseAccountRepository
  private readonly media: SupabaseMediaRepository
  private readonly profiles: SupabaseProfilesRepository
  private readonly communities: SupabaseCommunitiesRepository
  private readonly relationships: SupabaseRelationshipsRepository
  private readonly profileMessages: SupabaseProfileMessagesRepository
  private readonly communityForum: SupabaseCommunityForumRepository
  private readonly activity: SupabaseActivityRepository
  private readonly search: SupabaseSearchRepository

  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    this.accounts = new SupabaseAccountRepository(projectUrl, publishableKey, apiSecret)
    this.media = new SupabaseMediaRepository(projectUrl, publishableKey, apiSecret)
    this.profiles = new SupabaseProfilesRepository(projectUrl, publishableKey, apiSecret)
    this.communities = new SupabaseCommunitiesRepository(projectUrl, publishableKey, apiSecret)
    this.relationships = new SupabaseRelationshipsRepository(projectUrl, publishableKey, apiSecret)
    this.profileMessages = new SupabaseProfileMessagesRepository(projectUrl, publishableKey, apiSecret)
    this.communityForum = new SupabaseCommunityForumRepository(projectUrl, publishableKey, apiSecret)
    this.activity = new SupabaseActivityRepository(projectUrl, publishableKey, apiSecret)
    this.search = new SupabaseSearchRepository(projectUrl, publishableKey, apiSecret)
  }

  getAccountById(...args: Parameters<DataRepository['getAccountById']>): ReturnType<DataRepository['getAccountById']> {
    return this.accounts.getAccountById(...args)
  }

  accountOwnsProfile(...args: Parameters<DataRepository['accountOwnsProfile']>): ReturnType<DataRepository['accountOwnsProfile']> {
    return this.accounts.accountOwnsProfile(...args)
  }

  findAccountByEmail(...args: Parameters<DataRepository['findAccountByEmail']>): ReturnType<DataRepository['findAccountByEmail']> {
    return this.accounts.findAccountByEmail(...args)
  }

  consumeAuthRateLimit(...args: Parameters<DataRepository['consumeAuthRateLimit']>): ReturnType<DataRepository['consumeAuthRateLimit']> {
    return this.accounts.consumeAuthRateLimit(...args)
  }

  deleteAccount(...args: Parameters<DataRepository['deleteAccount']>): ReturnType<DataRepository['deleteAccount']> {
    return this.accounts.deleteAccount(...args)
  }

  createAccountWithRefreshToken(...args: Parameters<DataRepository['createAccountWithRefreshToken']>): ReturnType<DataRepository['createAccountWithRefreshToken']> {
    return this.accounts.createAccountWithRefreshToken(...args)
  }

  updateAccountPreferences(...args: Parameters<DataRepository['updateAccountPreferences']>): ReturnType<DataRepository['updateAccountPreferences']> {
    return this.accounts.updateAccountPreferences(...args)
  }

  issueRefreshToken(...args: Parameters<DataRepository['issueRefreshToken']>): ReturnType<DataRepository['issueRefreshToken']> {
    return this.accounts.issueRefreshToken(...args)
  }

  deleteRefreshTokenByHash(...args: Parameters<DataRepository['deleteRefreshTokenByHash']>): ReturnType<DataRepository['deleteRefreshTokenByHash']> {
    return this.accounts.deleteRefreshTokenByHash(...args)
  }

  changeAccountProfile(...args: Parameters<DataRepository['changeAccountProfile']>): ReturnType<DataRepository['changeAccountProfile']> {
    return this.accounts.changeAccountProfile(...args)
  }

  createUpload(...args: Parameters<DataRepository['createUpload']>): ReturnType<DataRepository['createUpload']> {
    return this.media.createUpload(...args)
  }

  getUploadById(...args: Parameters<DataRepository['getUploadById']>): ReturnType<DataRepository['getUploadById']> {
    return this.media.getUploadById(...args)
  }

  deletePendingUpload(...args: Parameters<DataRepository['deletePendingUpload']>): ReturnType<DataRepository['deletePendingUpload']> {
    return this.media.deletePendingUpload(...args)
  }

  completeUpload(...args: Parameters<DataRepository['completeUpload']>): ReturnType<DataRepository['completeUpload']> {
    return this.media.completeUpload(...args)
  }

  claimExpiredUploads(...args: Parameters<DataRepository['claimExpiredUploads']>): ReturnType<DataRepository['claimExpiredUploads']> {
    return this.media.claimExpiredUploads(...args)
  }

  finishUploadDeletions(...args: Parameters<DataRepository['finishUploadDeletions']>): ReturnType<DataRepository['finishUploadDeletions']> {
    return this.media.finishUploadDeletions(...args)
  }

  scheduleUploadDeletion(...args: Parameters<DataRepository['scheduleUploadDeletion']>): ReturnType<DataRepository['scheduleUploadDeletion']> {
    return this.media.scheduleUploadDeletion(...args)
  }

  claimUploadDeletion(...args: Parameters<DataRepository['claimUploadDeletion']>): ReturnType<DataRepository['claimUploadDeletion']> {
    return this.media.claimUploadDeletion(...args)
  }

  schedulePreviousAvatarDeletion(...args: Parameters<DataRepository['schedulePreviousAvatarDeletion']>): ReturnType<DataRepository['schedulePreviousAvatarDeletion']> {
    return this.media.schedulePreviousAvatarDeletion(...args)
  }

  getEditorImageRecord(...args: Parameters<DataRepository['getEditorImageRecord']>): ReturnType<DataRepository['getEditorImageRecord']> {
    return this.media.getEditorImageRecord(...args)
  }

  getAvatarUploadPath(...args: Parameters<DataRepository['getAvatarUploadPath']>): ReturnType<DataRepository['getAvatarUploadPath']> {
    return this.media.getAvatarUploadPath(...args)
  }

  setProfileAvatar(...args: Parameters<DataRepository['setProfileAvatar']>): ReturnType<DataRepository['setProfileAvatar']> {
    return this.media.setProfileAvatar(...args)
  }

  setCommunityAvatar(...args: Parameters<DataRepository['setCommunityAvatar']>): ReturnType<DataRepository['setCommunityAvatar']> {
    return this.media.setCommunityAvatar(...args)
  }

  getProfilesByIds(...args: Parameters<DataRepository['getProfilesByIds']>): ReturnType<DataRepository['getProfilesByIds']> {
    return this.profiles.getProfilesByIds(...args)
  }

  deleteProfile(...args: Parameters<DataRepository['deleteProfile']>): ReturnType<DataRepository['deleteProfile']> {
    return this.profiles.deleteProfile(...args)
  }

  createProfile(...args: Parameters<DataRepository['createProfile']>): ReturnType<DataRepository['createProfile']> {
    return this.profiles.createProfile(...args)
  }

  updateProfile(...args: Parameters<DataRepository['updateProfile']>): ReturnType<DataRepository['updateProfile']> {
    return this.profiles.updateProfile(...args)
  }

  createProfilePost(...args: Parameters<DataRepository['createProfilePost']>): ReturnType<DataRepository['createProfilePost']> {
    return this.profiles.createProfilePost(...args)
  }

  getProfileSettings(...args: Parameters<DataRepository['getProfileSettings']>): ReturnType<DataRepository['getProfileSettings']> {
    return this.profiles.getProfileSettings(...args)
  }

  updateProfileSettings(...args: Parameters<DataRepository['updateProfileSettings']>): ReturnType<DataRepository['updateProfileSettings']> {
    return this.profiles.updateProfileSettings(...args)
  }

  getProfilesPage(...args: Parameters<DataRepository['getProfilesPage']>): ReturnType<DataRepository['getProfilesPage']> {
    return this.profiles.getProfilesPage(...args)
  }

  getProfileByUrl(...args: Parameters<DataRepository['getProfileByUrl']>): ReturnType<DataRepository['getProfileByUrl']> {
    return this.profiles.getProfileByUrl(...args)
  }

  getOwnedProfiles(...args: Parameters<DataRepository['getOwnedProfiles']>): ReturnType<DataRepository['getOwnedProfiles']> {
    return this.profiles.getOwnedProfiles(...args)
  }

  getProfileFriends(...args: Parameters<DataRepository['getProfileFriends']>): ReturnType<DataRepository['getProfileFriends']> {
    return this.profiles.getProfileFriends(...args)
  }

  getProfileEditPage(...args: Parameters<DataRepository['getProfileEditPage']>): ReturnType<DataRepository['getProfileEditPage']> {
    return this.profiles.getProfileEditPage(...args)
  }

  getProfileDirectoryPage(...args: Parameters<DataRepository['getProfileDirectoryPage']>): ReturnType<DataRepository['getProfileDirectoryPage']> {
    return this.profiles.getProfileDirectoryPage(...args)
  }

  getProfilePage(...args: Parameters<DataRepository['getProfilePage']>): ReturnType<DataRepository['getProfilePage']> {
    return this.profiles.getProfilePage(...args)
  }

  getCommunitiesByIds(...args: Parameters<DataRepository['getCommunitiesByIds']>): ReturnType<DataRepository['getCommunitiesByIds']> {
    return this.communities.getCommunitiesByIds(...args)
  }

  getSuggestedCommunities(...args: Parameters<DataRepository['getSuggestedCommunities']>): ReturnType<DataRepository['getSuggestedCommunities']> {
    return this.communities.getSuggestedCommunities(...args)
  }

  createCommunity(...args: Parameters<DataRepository['createCommunity']>): ReturnType<DataRepository['createCommunity']> {
    return this.communities.createCommunity(...args)
  }

  updateCommunity(...args: Parameters<DataRepository['updateCommunity']>): ReturnType<DataRepository['updateCommunity']> {
    return this.communities.updateCommunity(...args)
  }

  getPublicCommunities(...args: Parameters<DataRepository['getPublicCommunities']>): ReturnType<DataRepository['getPublicCommunities']> {
    return this.communities.getPublicCommunities(...args)
  }

  getCommunityByUrl(...args: Parameters<DataRepository['getCommunityByUrl']>): ReturnType<DataRepository['getCommunityByUrl']> {
    return this.communities.getCommunityByUrl(...args)
  }

  getProfileCommunities(...args: Parameters<DataRepository['getProfileCommunities']>): ReturnType<DataRepository['getProfileCommunities']> {
    return this.communities.getProfileCommunities(...args)
  }

  getCommunityEditPage(...args: Parameters<DataRepository['getCommunityEditPage']>): ReturnType<DataRepository['getCommunityEditPage']> {
    return this.communities.getCommunityEditPage(...args)
  }

  getCommunityForumComposerPage(...args: Parameters<DataRepository['getCommunityForumComposerPage']>): ReturnType<DataRepository['getCommunityForumComposerPage']> {
    return this.communities.getCommunityForumComposerPage(...args)
  }

  getCommunitiesPage(...args: Parameters<DataRepository['getCommunitiesPage']>): ReturnType<DataRepository['getCommunitiesPage']> {
    return this.communities.getCommunitiesPage(...args)
  }

  getCommunityPage(...args: Parameters<DataRepository['getCommunityPage']>): ReturnType<DataRepository['getCommunityPage']> {
    return this.communities.getCommunityPage(...args)
  }

  getCommunityMembersPage(...args: Parameters<DataRepository['getCommunityMembersPage']>): ReturnType<DataRepository['getCommunityMembersPage']> {
    return this.communities.getCommunityMembersPage(...args)
  }

  upsertProfileRelationship(...args: Parameters<DataRepository['upsertProfileRelationship']>): ReturnType<DataRepository['upsertProfileRelationship']> {
    return this.relationships.upsertProfileRelationship(...args)
  }

  removeProfileRelationship(...args: Parameters<DataRepository['removeProfileRelationship']>): ReturnType<DataRepository['removeProfileRelationship']> {
    return this.relationships.removeProfileRelationship(...args)
  }

  changeCommunityRelationship(...args: Parameters<DataRepository['changeCommunityRelationship']>): ReturnType<DataRepository['changeCommunityRelationship']> {
    return this.relationships.changeCommunityRelationship(...args)
  }

  getProfileRelationships(...args: Parameters<DataRepository['getProfileRelationships']>): ReturnType<DataRepository['getProfileRelationships']> {
    return this.relationships.getProfileRelationships(...args)
  }

  getCommunityRelationships(...args: Parameters<DataRepository['getCommunityRelationships']>): ReturnType<DataRepository['getCommunityRelationships']> {
    return this.relationships.getCommunityRelationships(...args)
  }

  listCommunityMembers(...args: Parameters<DataRepository['listCommunityMembers']>): ReturnType<DataRepository['listCommunityMembers']> {
    return this.relationships.listCommunityMembers(...args)
  }

  listPendingMembers(...args: Parameters<DataRepository['listPendingMembers']>): ReturnType<DataRepository['listPendingMembers']> {
    return this.relationships.listPendingMembers(...args)
  }

  createProfileMessage(...args: Parameters<DataRepository['createProfileMessage']>): ReturnType<DataRepository['createProfileMessage']> {
    return this.profileMessages.createProfileMessage(...args)
  }

  deleteProfileMessage(...args: Parameters<DataRepository['deleteProfileMessage']>): ReturnType<DataRepository['deleteProfileMessage']> {
    return this.profileMessages.deleteProfileMessage(...args)
  }

  setProfileMessageFavorite(...args: Parameters<DataRepository['setProfileMessageFavorite']>): ReturnType<DataRepository['setProfileMessageFavorite']> {
    return this.profileMessages.setProfileMessageFavorite(...args)
  }

  getProfileMessages(...args: Parameters<DataRepository['getProfileMessages']>): ReturnType<DataRepository['getProfileMessages']> {
    return this.profileMessages.getProfileMessages(...args)
  }

  getProfileMessagesPage(...args: Parameters<DataRepository['getProfileMessagesPage']>): ReturnType<DataRepository['getProfileMessagesPage']> {
    return this.profileMessages.getProfileMessagesPage(...args)
  }

  listCommunityForumTopics(...args: Parameters<DataRepository['listCommunityForumTopics']>): ReturnType<DataRepository['listCommunityForumTopics']> {
    return this.communityForum.listCommunityForumTopics(...args)
  }

  getCommunityForumTopic(...args: Parameters<DataRepository['getCommunityForumTopic']>): ReturnType<DataRepository['getCommunityForumTopic']> {
    return this.communityForum.getCommunityForumTopic(...args)
  }

  getCommunityForumPage(...args: Parameters<DataRepository['getCommunityForumPage']>): ReturnType<DataRepository['getCommunityForumPage']> {
    return this.communityForum.getCommunityForumPage(...args)
  }

  getCommunityForumTopicPage(...args: Parameters<DataRepository['getCommunityForumTopicPage']>): ReturnType<DataRepository['getCommunityForumTopicPage']> {
    return this.communityForum.getCommunityForumTopicPage(...args)
  }

  createCommunityForumTopic(...args: Parameters<DataRepository['createCommunityForumTopic']>): ReturnType<DataRepository['createCommunityForumTopic']> {
    return this.communityForum.createCommunityForumTopic(...args)
  }

  createCommunityForumReply(...args: Parameters<DataRepository['createCommunityForumReply']>): ReturnType<DataRepository['createCommunityForumReply']> {
    return this.communityForum.createCommunityForumReply(...args)
  }

  moderateCommunityForumTopic(...args: Parameters<DataRepository['moderateCommunityForumTopic']>): ReturnType<DataRepository['moderateCommunityForumTopic']> {
    return this.communityForum.moderateCommunityForumTopic(...args)
  }

  deleteCommunityForumTopic(...args: Parameters<DataRepository['deleteCommunityForumTopic']>): ReturnType<DataRepository['deleteCommunityForumTopic']> {
    return this.communityForum.deleteCommunityForumTopic(...args)
  }

  deleteCommunityForumReply(...args: Parameters<DataRepository['deleteCommunityForumReply']>): ReturnType<DataRepository['deleteCommunityForumReply']> {
    return this.communityForum.deleteCommunityForumReply(...args)
  }

  getActivityFeedRows(...args: Parameters<DataRepository['getActivityFeedRows']>): ReturnType<DataRepository['getActivityFeedRows']> {
    return this.activity.getActivityFeedRows(...args)
  }

  getActivityReadIds(...args: Parameters<DataRepository['getActivityReadIds']>): ReturnType<DataRepository['getActivityReadIds']> {
    return this.activity.getActivityReadIds(...args)
  }

  markActivitiesRead(...args: Parameters<DataRepository['markActivitiesRead']>): ReturnType<DataRepository['markActivitiesRead']> {
    return this.activity.markActivitiesRead(...args)
  }

  searchEntities(...args: Parameters<DataRepository['searchEntities']>): ReturnType<DataRepository['searchEntities']> {
    return this.search.searchEntities(...args)
  }
}
