import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { JwtAccessGuard, OptionalJwtAccessGuard } from './auth/jwt-access.guard'
import { DomainController } from './domain/domain.controller'
import { DomainService } from './domain/domain.service'

@Module({
  controllers: [AuthController, DomainController],
  providers: [AuthService, DomainService, JwtAccessGuard, OptionalJwtAccessGuard]
})
export class ApiModule {}
