import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { PaginationDto } from '../pagination/pagination.dto'
import { CommunityMembersPageDto } from './community-members-page.dto'
import {
  CommunitiesPageDto,
  CreateCommunityDto,
  CreateForumReplyDto,
  CreateForumTopicDto,
  ForumActorDto,
  ForumModerationDto,
  UpdateCommunityDto
} from './domain.dto'
import { DomainService } from './domain.service'
import { CommunityPageService } from './community-page.service'
import { CommunityForumPageService } from './community-forum-page.service'
import { CommunityForumTopicPageService } from './community-forum-topic-page.service'
import { CommunityMembersPageService } from './community-members-page.service'
import { CommunitiesPageService } from './communities-page.service'
import { CommunityForumComposerPageService } from './community-forum-composer-page.service'
import { CommunityEditPageService } from './community-edit-page.service'

@Controller()
export class CommunitiesController {
  constructor(
    private readonly domain: DomainService,
    private readonly communityPage: CommunityPageService,
    private readonly communityForumPage: CommunityForumPageService,
    private readonly communityForumTopicPage: CommunityForumTopicPageService,
    private readonly communityMembersPage: CommunityMembersPageService,
    private readonly communitiesPage: CommunitiesPageService,
    private readonly communityForumComposerPage: CommunityForumComposerPageService,
    private readonly communityEditPage: CommunityEditPageService
  ) {}

  @Get('communities/by-url/:url/page')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityPage(
    @Param('url') url: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.communityPage.getCommunityPage(url, user?.id ?? null)
  }

  @Get('communities/by-url/:url/forum/page')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityForumPage(
    @Param('url') url: string,
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.communityForumPage.getCommunityForumPage(url, query, user?.id ?? null)
  }

  @Get('communities/by-url/:url/forum/composer-page')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityForumComposerPage(
    @Param('url') url: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.communityForumComposerPage.getCommunityForumComposerPage(url, user?.id ?? null)
  }

  @Get('communities/by-url/:url/edit/page')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityEditPage(
    @Param('url') url: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.communityEditPage.getCommunityEditPage(url, user?.id ?? null)
  }

  @Get('communities/page')
  @UseGuards(JwtAccessGuard)
  getCommunitiesPage(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() query: CommunitiesPageDto
  ) {
    return this.communitiesPage.getCommunitiesPage(user.id, query)
  }

  @Get('communities')
  listCommunities(@Query() query: PaginationDto) {
    return this.domain.listCommunities(query)
  }

  @Get('communities/by-url/:url')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunity(
    @Param('url') url: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.domain.getCommunity(url, user?.id ?? null)
  }

  @Get('communities/ids')
  getCommunities(@Query('ids') ids: string | string[]) {
    return this.domain.getCommunitiesByIds(Array.isArray(ids) ? ids : ids ? [ids] : [])
  }

  @Get('communities/profile/:profileId')
  profileCommunities(@Param('profileId') id: string, @Query() query: PaginationDto) {
    return this.domain.listProfileCommunities(id, query)
  }

  @Post('communities')
  @UseGuards(JwtAccessGuard)
  createCommunity(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: CreateCommunityDto
  ) {
    const { ownerProfileId, ...community } = body
    return this.domain.createCommunity(user.id, ownerProfileId, community)
  }

  @Put('communities/:communityId')
  @UseGuards(JwtAccessGuard)
  updateCommunity(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId') id: string,
    @Body() body: UpdateCommunityDto
  ) {
    return this.domain.updateCommunity(user.id, id, body)
  }

  @Get('communities/:communityId/forum/topics')
  @UseGuards(OptionalJwtAccessGuard)
  forumTopics(
    @Param('communityId') id: string,
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.domain.listCommunityForumTopics(id, query, user?.id ?? null)
  }

  @Get('communities/by-url/:url/members/page')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityMembersPage(
    @Param('url') url: string,
    @Query() query: CommunityMembersPageDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.communityMembersPage.getCommunityMembersPage(url, query, user?.id ?? null)
  }

  @Get('communities/by-url/:url/forum/topics/:topicId/page')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityForumTopicPage(
    @Param('url') url: string,
    @Param('topicId') topicId: string,
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.communityForumTopicPage.getCommunityForumTopicPage(
      url,
      topicId,
      query,
      user?.id ?? null
    )
  }

  @Get('communities/:communityId/forum/topics/:topicId')
  @UseGuards(OptionalJwtAccessGuard)
  forumTopic(
    @Param('communityId') id: string,
    @Param('topicId') topicId: string,
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.domain.getCommunityForumTopic(id, topicId, query, user?.id ?? null)
  }

  @Post('communities/:communityId/forum/topics')
  @UseGuards(JwtAccessGuard)
  createForumTopic(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId') id: string,
    @Body() body: CreateForumTopicDto
  ) {
    return this.domain.createCommunityForumTopic(
      user.id,
      id,
      body.profileId,
      body.title,
      body.content
    )
  }

  @Post('communities/:communityId/forum/topics/:topicId/replies')
  @UseGuards(JwtAccessGuard)
  createForumReply(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId') id: string,
    @Param('topicId') topicId: string,
    @Body() body: CreateForumReplyDto
  ) {
    return this.domain.createCommunityForumReply(
      user.id,
      id,
      topicId,
      body.profileId,
      body.content
    )
  }

  @Put('communities/:communityId/forum/topics/:topicId/moderation')
  @UseGuards(JwtAccessGuard)
  moderateForumTopic(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId') id: string,
    @Param('topicId') topicId: string,
    @Body() body: ForumModerationDto
  ) {
    const { profileId, ...changes } = body
    return this.domain.moderateCommunityForumTopic(user.id, id, topicId, profileId, changes)
  }

  @Delete('communities/:communityId/forum/topics/:topicId')
  @UseGuards(JwtAccessGuard)
  async deleteForumTopic(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId') id: string,
    @Param('topicId') topicId: string,
    @Body() body: ForumActorDto
  ) {
    await this.domain.deleteCommunityForumTopic(user.id, id, topicId, body.profileId)
    return { success: true }
  }

  @Delete('communities/:communityId/forum/replies/:replyId')
  @UseGuards(JwtAccessGuard)
  async deleteForumReply(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId') id: string,
    @Param('replyId') replyId: string,
    @Body() body: ForumActorDto
  ) {
    await this.domain.deleteCommunityForumReply(user.id, id, replyId, body.profileId)
    return { success: true }
  }
}
