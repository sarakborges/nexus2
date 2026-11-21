import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common'
import { AuthService } from './auth/auth.service'
import { CommunityForumRealtimeService } from './domain/community-forum-realtime.service'
import { VerifyRealtimeEventDto } from './realtime.dto'

@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtime: CommunityForumRealtimeService,
    private readonly auth: AuthService
  ) {}

  @Get('config')
  getConfig() {
    return this.realtime.getPublicConfig()
  }

  @Post('verify')
  @HttpCode(200)
  async verifyTopicChanged(
    @Body() body: VerifyRealtimeEventDto,
    @Headers('x-nexus-client-ip') clientIp = 'unknown'
  ): Promise<{ valid: boolean }> {
    await this.auth.assertAuthAttemptAllowed('realtime-verify', clientIp)
    return {
      valid: this.realtime.verifyTopicChanged(body.topicId, body.changedAt, body.signature)
    }
  }
}
