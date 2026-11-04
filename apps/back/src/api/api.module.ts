import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { JwtAccessGuard, OptionalJwtAccessGuard } from './auth/jwt-access.guard'
import { DomainController } from './domain/domain.controller'
import { DomainService } from './domain/domain.service'
import { DomainAccessService } from './domain/domain-access.service'
import { CommunityForumService } from './domain/community-forum.service'
import { ProfileMessageService } from './domain/profile-message.service'
import { UploadsController, UploadsInternalController } from './uploads/uploads.controller'
import { UploadsService } from './uploads/uploads.service'

@Module({
  controllers: [AuthController, DomainController, UploadsController, UploadsInternalController],
  providers: [AuthService, DomainAccessService, CommunityForumService, ProfileMessageService, DomainService, UploadsService, JwtAccessGuard, OptionalJwtAccessGuard]
})
export class ApiModule {}
