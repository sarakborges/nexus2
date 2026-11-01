import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HttpModule } from '@nestjs/axios'
import { AuthController } from './auth/auth.controller'
import { ApiProxyController } from './proxy/api-proxy.controller'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  controllers: [AuthController, ApiProxyController]
})
export class AppModule {}
