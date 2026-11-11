import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { PaginationDto } from '../pagination/pagination.dto'
import {
  ActorDto,
  MessageDto,
  ProfileMessageFavoriteDto,
  ProfileMessagesPageDto,
  ProfilePostDto
} from './domain.dto'
import { DomainService } from './domain.service'
import { ProfileMessagesPageService } from './profile-messages-page.service'
import { ProfilePostService } from './profile-post.service'

@Controller()
export class ProfileMessagesController {
  constructor(
    private readonly domain: DomainService,
    private readonly profileMessagesPage: ProfileMessagesPageService,
    private readonly profilePosts: ProfilePostService
  ) {}

  @Get('profiles/by-url/:url/messages/page')
  @UseGuards(OptionalJwtAccessGuard)
  getProfileMessagesPage(
    @Param('url') url: string,
    @Query() query: ProfileMessagesPageDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.profileMessagesPage.getProfileMessagesPage(url, query, user?.id ?? null)
  }

  @Get('profiles/:profileId/messages')
  @UseGuards(OptionalJwtAccessGuard)
  messages(
    @Param('profileId') id: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined,
    @Query() query: PaginationDto
  ) {
    return this.domain.getMessages(id, user?.id ?? null, query)
  }

  @Post('profiles/:profileId/messages')
  @UseGuards(JwtAccessGuard)
  sendMessage(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') id: string,
    @Body() body: MessageDto
  ) {
    return this.domain.sendMessage(user.id, body.fromProfileId, id, body.content)
  }

  @Delete('profiles/:profileId/messages/:messageId')
  @UseGuards(JwtAccessGuard)
  async deleteProfileMessage(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') profileId: string,
    @Param('messageId') messageId: string,
    @Body() body: ActorDto
  ) {
    await this.domain.deleteProfileMessage(user.id, profileId, messageId, body.actorProfileId)
    return { success: true }
  }

  @Put('profiles/:profileId/messages/:messageId/favorite')
  @UseGuards(JwtAccessGuard)
  setProfileMessageFavorite(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') profileId: string,
    @Param('messageId') messageId: string,
    @Body() body: ProfileMessageFavoriteDto
  ) {
    return this.domain.setProfileMessageFavorite(
      user.id,
      profileId,
      messageId,
      body.actorProfileId,
      body.isFavorite
    )
  }

  @Post('profiles/:profileId/posts')
  @UseGuards(JwtAccessGuard)
  createProfilePost(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') profileId: string,
    @Body() body: ProfilePostDto
  ) {
    return this.profilePosts.createProfilePost(user.id, profileId, body.content)
  }
}
