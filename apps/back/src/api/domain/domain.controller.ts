import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard } from '../auth/jwt-access.guard'
import { SearchDto } from './domain.dto'
import { DomainService } from './domain.service'
import { HomePageService } from './home-page.service'
import { ActivityFeedPageDto } from './activity-feed-page.dto'

@Controller()
export class DomainController {
  constructor(
    private readonly domain: DomainService,
    private readonly homePage: HomePageService
  ) {}

  @Get('search')
  search(@Query() q: SearchDto) {
    return this.domain.searchEntities(q.query, q.scope ?? 'all', q)
  }

  @Get('home')
  @UseGuards(JwtAccessGuard)
  getHomePage(@CurrentUser() user: AuthenticatedUserContext) {
    return this.homePage.getHomePage(user.id)
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
