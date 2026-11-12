import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DataRepository } from './repository.interface'
import { DATA_REPOSITORY } from './repository.interface'
import { SupabaseRelationalRepository } from './supabase-relational.repository'

const REQUIRED_RELATIONAL_METHODS = [
  'getAccountById',
  'findAccountByEmail',
  'getProfilesByIds',
  'getCommunitiesByIds',
  'createAccountWithRefreshToken',
  'updateAccountPreferences',
  'createUpload',
  'getUploadById',
  'deletePendingUpload',
  'completeUpload',
  'claimExpiredUploads',
  'finishUploadDeletions',
  'scheduleUploadDeletion',
  'claimUploadDeletion',
  'schedulePreviousAvatarDeletion',
  'getEditorImageRecord',
  'getAvatarUploadPath',
  'setProfileAvatar',
  'setCommunityAvatar',
  'createProfile',
  'updateProfile',
  'createCommunity',
  'updateCommunity',
  'createProfilePost',
  'issueRefreshToken',
  'deleteRefreshTokenByHash',
  'changeAccountProfile',
  'upsertProfileRelationship',
  'removeProfileRelationship',
  'changeCommunityRelationship',
  'getProfileSettings',
  'updateProfileSettings',
  'createProfileMessage',
  'deleteProfileMessage',
  'setProfileMessageFavorite',
  'getProfileMessages',
  'getProfilePage',
  'listCommunityForumTopics',
  'getCommunityForumTopic',
  'getProfilesPage',
  'getProfileByUrl',
  'getPublicCommunities',
  'getOwnedProfiles',
  'getCommunityByUrl',
  'getProfileCommunities',
  'searchEntities',
  'getProfileRelationships',
  'getProfileFriends',
  'getCommunityRelationships',
  'listCommunityMembers',
  'listPendingMembers',
  'getProfileEditPage',
  'getCommunityEditPage',
  'getCommunityForumComposerPage',
  'getCommunitiesPage',
  'getProfileDirectoryPage',
  'getCommunityPage',
  'getCommunityMembersPage',
  'getProfileMessagesPage',
  'getCommunityForumPage',
  'getCommunityForumTopicPage',
  'createCommunityForumTopic',
  'createCommunityForumReply',
  'moderateCommunityForumTopic',
  'deleteCommunityForumTopic',
  'deleteCommunityForumReply',
  'getActivityFeedRows'
] as const

@Global()
@Module({
  providers: [
    {
      provide: DATA_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DataRepository => {
        const projectUrl = config.get<string>('SUPABASE_URL')
        const publishableKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY')
        const apiSecret = config.get<string>('SUPABASE_API_SECRET')

        if (!projectUrl || !publishableKey || !apiSecret) {
          throw new Error(
            'Relational Supabase storage is required in every environment. Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_API_SECRET.'
          )
        }

        const repository = new SupabaseRelationalRepository(projectUrl, publishableKey, apiSecret)
        const capabilities = repository as unknown as Record<string, unknown>
        const missing = REQUIRED_RELATIONAL_METHODS.filter(method =>
          typeof capabilities[method] !== 'function'
        )
        if (missing.length > 0) {
          throw new Error(
            'Supabase relational repository is incomplete. Missing operations: ' + missing.join(', ')
          )
        }
        return repository
      }
    }
  ],
  exports: [DATA_REPOSITORY]
})
export class StorageModule {}
