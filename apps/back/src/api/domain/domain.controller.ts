import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard } from '../auth/jwt-access.guard'
import { SearchDto } from './domain.dto'
import { DomainService } from './domain.service'
import { ActivityFeedPageDto } from './activity-feed-page.dto'
import { ActivityReadDto } from './activity-read.dto'

@Controller()
export class DomainController {
  constructor(private readonly domain: DomainService) {}

  @Get('search')
  search(@Query() q: SearchDto) {
    return this.domain.searchEntities(q.query, q.scope ?? 'all', q)
  }

  @Post('activity/read')
  @UseGuards(JwtAccessGuard)
  markActivityRead(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: ActivityReadDto
  ) {
    return this.domain.markActivitiesRead(user.id, body.activityIds)
  }

  @Get('activity')
  @UseGuards(JwtAccessGuard)
  recentActivity(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() query: ActivityFeedPageDto
  ) {
    const hasUpdatedAt = query.cursorUpdatedAt !== undefined
    const hasCursorId = query.cursorId !== undefined
    if (hasUpdatedAt !== hasCursorId) {
      throw new BadRequestException('INVALID_ACTIVITY_CURSOR')
    }
    return this.domain.getRecentActivityPage(
      user.id,
      query.limit,
      hasUpdatedAt ? { updatedAt: query.cursorUpdatedAt!, id: query.cursorId! } : null
    )
  }
}
