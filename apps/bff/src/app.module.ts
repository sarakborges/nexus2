import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HttpModule } from '@nestjs/axios'
import { AuthController } from './auth/auth.controller'
import { ApiProxyController } from './proxy/api-proxy.controller'

export const BFF_BACKEND_TIMEOUT_MS = 30_000

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule.register({ timeout: BFF_BACKEND_TIMEOUT_MS })],
  controllers: [AuthController, ApiProxyController]
})
export class AppModule {}
