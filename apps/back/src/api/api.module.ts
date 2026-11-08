import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { AccountService } from './auth/account.service'
import { JwtAccessGuard, OptionalJwtAccessGuard } from './auth/jwt-access.guard'
import { DomainController } from './domain/domain.controller'
import { DomainService } from './domain/domain.service'
import { DomainAccessService } from './domain/domain-access.service'
import { CommunityForumService } from './domain/community-forum.service'
import { ProfileMessageService } from './domain/profile-message.service'
import { ActivityService } from './domain/activity.service'
import { HomePageService } from './domain/home-page.service'
import { ProfileService } from './domain/profile.service'
import { ProfileRelationshipService } from './domain/profile-relationship.service'
import { CommunityService } from './domain/community.service'
import { CommunityMembershipService } from './domain/community-membership.service'
import { UploadsController, UploadsInternalController } from './uploads/uploads.controller'
import { UploadsService } from './uploads/uploads.service'
import { UploadsCleanupService } from './uploads/uploads.cleanup.service'
import { UploadsContentService } from './uploads/uploads.content.service'
import { UploadsAvatarService } from './uploads/uploads.avatar.service'
import { UploadsStorageService } from './uploads/uploads.storage.service'

@Module({
  controllers: [AuthController, DomainController, UploadsController, UploadsInternalController],
  providers: [AccountService, AuthService, DomainAccessService, ProfileService, ProfileRelationshipService, CommunityService, CommunityForumService, ProfileMessageService, ActivityService, HomePageService, DomainService, CommunityMembershipService, UploadsService, UploadsStorageService, UploadsCleanupService, UploadsContentService, UploadsAvatarService, JwtAccessGuard, OptionalJwtAccessGuard]
})
export class ApiModule {}
