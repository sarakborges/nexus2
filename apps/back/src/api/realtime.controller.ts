import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { CommunityForumRealtimeService } from './domain/community-forum-realtime.service'
import { VerifyRealtimeEventDto } from './realtime.dto'

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: CommunityForumRealtimeService) {}

  @Get('config')
  getConfig() {
    return this.realtime.getPublicConfig()
  }

  @Post('verify')
  @HttpCode(200)
  verifyTopicChanged(@Body() body: VerifyRealtimeEventDto): { valid: boolean } {
    return {
      valid: this.realtime.verifyTopicChanged(body.topicId, body.changedAt, body.signature)
    }
  }
}
