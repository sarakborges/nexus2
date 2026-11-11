import { Controller, Get } from '@nestjs/common'
import { CommunityForumRealtimeService } from './domain/community-forum-realtime.service'

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: CommunityForumRealtimeService) {}

  @Get('config')
  getConfig() {
    return this.realtime.getPublicConfig()
  }
}
