import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { JwtAccessGuard, OptionalJwtAccessGuard } from './auth/jwt-access.guard'
import { DomainController } from './domain/domain.controller'
import { DomainService } from './domain/domain.service'
import { UploadsController, UploadsInternalController } from './uploads/uploads.controller'
import { UploadsService } from './uploads/uploads.service'

@Module({
  controllers: [AuthController, DomainController, UploadsController, UploadsInternalController],
  providers: [AuthService, DomainService, UploadsService, JwtAccessGuard, OptionalJwtAccessGuard]
})
export class ApiModule {}
