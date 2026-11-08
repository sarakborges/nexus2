import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { PaginationDto } from '../pagination/pagination.dto'
import {
  ActorDto,
  CommunityRelationDto,
  CreateCommunityDto,
  CreateForumReplyDto,
  CreateForumTopicDto,
  CreateProfileDto,
  ForumActorDto,
  ForumModerationDto,
  MessageDto,
  OwnershipDto,
  ProfileRelationDto,
  UpdateCommunityDto,
  UpdateProfileDto
} from './domain.dto'
import { DomainService } from './domain.service'
import { HomePageService } from './home-page.service'
import { ProfilePageService } from './profile-page.service'
import { CommunityPageService } from './community-page.service'
import { CommunityForumPageService } from './community-forum-page.service'
import { CommunityForumTopicPageService } from './community-forum-topic-page.service'
import { CommunityMembersPageService } from './community-members-page.service'
import { CommunityMembersPageDto } from './community-members-page.dto'

@Controller()
export class DomainController {
  constructor(
    private readonly domain: DomainService,
    private readonly homePage: HomePageService,
    private readonly profilePage: ProfilePageService,
    private readonly communityPage: CommunityPageService,
    private readonly communityForumPage: CommunityForumPageService,
    private readonly communityForumTopicPage: CommunityForumTopicPageService,
    private readonly communityMembersPage: CommunityMembersPageService
  ) {}

  @Get('home') @UseGuards(JwtAccessGuard)
  getHomePage(@CurrentUser() u: AuthenticatedUserContext) {
    return this.homePage.getHomePage(u.id)
  }

  @Get('activity') @UseGuards(JwtAccessGuard) recentActivity(@CurrentUser() u: AuthenticatedUserContext) { return this.domain.getRecentActivity(u.id) }

  @Get('profiles/by-url/:url/page')
  getProfilePage(@Param('url') url: string) {
    return this.profilePage.getProfilePage(url)
  }

  @Get('profiles') listProfiles(@Query() q: PaginationDto) { return this.domain.listProfiles(q) }
  @Get('profiles/owned') @UseGuards(JwtAccessGuard) ownedProfiles(@CurrentUser() u: AuthenticatedUserContext, @Query() q: PaginationDto) { return this.domain.listOwnedProfiles(u.id, q) }
  @Get('profiles/by-url/:url') getProfile(@Param('url') url: string) { return this.domain.getProfile(url) }
  @Get('profiles/ids') getProfiles(@Query('ids') ids: string | string[]) { return this.domain.getProfilesByIds(Array.isArray(ids) ? ids : ids ? [ids] : []) }
  @Post('profiles') @UseGuards(JwtAccessGuard) createProfile(@CurrentUser() u: AuthenticatedUserContext, @Body() body: CreateProfileDto) { return this.domain.createProfile(u.id, body) }
  @Put('profiles/:profileId') @UseGuards(JwtAccessGuard) updateProfile(@CurrentUser() u: AuthenticatedUserContext, @Param('profileId') id: string, @Body() body: UpdateProfileDto) { return this.domain.updateProfile(u.id, id, body) }

  @Get('communities/by-url/:url/page') @UseGuards(OptionalJwtAccessGuard)
  getCommunityPage(
    @Param('url') url: string,
    @CurrentUser() u: AuthenticatedUserContext | undefined
  ) {
    return this.communityPage.getCommunityPage(url, u?.id ?? null)
  }

  @Get('communities/by-url/:url/forum/page') @UseGuards(OptionalJwtAccessGuard)
  getCommunityForumPage(
    @Param('url') url: string,
    @Query() q: PaginationDto,
    @CurrentUser() u: AuthenticatedUserContext | undefined
  ) {
    return this.communityForumPage.getCommunityForumPage(url, q, u?.id ?? null)
  }

  @Get('communities') listCommunities(@Query() q: PaginationDto) { return this.domain.listCommunities(q) }
  @Get('communities/by-url/:url') @UseGuards(OptionalJwtAccessGuard)
  getCommunity(@Param('url') url: string, @CurrentUser() u: AuthenticatedUserContext | undefined) { return this.domain.getCommunity(url, u?.id ?? null) }
  @Get('communities/ids') getCommunities(@Query('ids') ids: string | string[]) { return this.domain.getCommunitiesByIds(Array.isArray(ids) ? ids : ids ? [ids] : []) }
  @Get('communities/profile/:profileId') profileCommunities(@Param('profileId') id: string, @Query() q: PaginationDto) { return this.domain.listProfileCommunities(id, q) }
  @Post('communities') @UseGuards(JwtAccessGuard) createCommunity(@CurrentUser() u: AuthenticatedUserContext, @Body() body: CreateCommunityDto) {
    const { ownerProfileId, ...community } = body
    return this.domain.createCommunity(u.id, ownerProfileId, community)
  }
  @Put('communities/:communityId') @UseGuards(JwtAccessGuard) updateCommunity(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Body() body: UpdateCommunityDto) {
    return this.domain.updateCommunity(u.id, id, body)
  }


  @Get('communities/:communityId/forum/topics') @UseGuards(OptionalJwtAccessGuard)
  forumTopics(@Param('communityId') id: string, @Query() q: PaginationDto, @CurrentUser() u: AuthenticatedUserContext | undefined) { return this.domain.listCommunityForumTopics(id, q, u?.id ?? null) }
  @Get('communities/by-url/:url/members/page') @UseGuards(OptionalJwtAccessGuard)
  getCommunityMembersPage(
    @Param('url') url: string,
    @Query() q: CommunityMembersPageDto,
    @CurrentUser() u: AuthenticatedUserContext | undefined
  ) {
    return this.communityMembersPage.getCommunityMembersPage(url, q, u?.id ?? null)
  }

  @Get('communities/by-url/:url/forum/topics/:topicId/page') @UseGuards(OptionalJwtAccessGuard)
  getCommunityForumTopicPage(
    @Param('url') url: string,
    @Param('topicId') topicId: string,
    @Query() q: PaginationDto,
    @CurrentUser() u: AuthenticatedUserContext | undefined
  ) {
    return this.communityForumTopicPage.getCommunityForumTopicPage(
      url,
      topicId,
      q,
      u?.id ?? null
    )
  }

  @Get('communities/:communityId/forum/topics/:topicId') @UseGuards(OptionalJwtAccessGuard)
  forumTopic(@Param('communityId') id: string, @Param('topicId') topicId: string, @Query() q: PaginationDto, @CurrentUser() u: AuthenticatedUserContext | undefined) { return this.domain.getCommunityForumTopic(id, topicId, q, u?.id ?? null) }
  @Post('communities/:communityId/forum/topics') @UseGuards(JwtAccessGuard)
  createForumTopic(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Body() body: CreateForumTopicDto) { return this.domain.createCommunityForumTopic(u.id, id, body.profileId, body.title, body.content) }
  @Post('communities/:communityId/forum/topics/:topicId/replies') @UseGuards(JwtAccessGuard)
  createForumReply(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Param('topicId') topicId: string, @Body() body: CreateForumReplyDto) { return this.domain.createCommunityForumReply(u.id, id, topicId, body.profileId, body.content) }
  @Put('communities/:communityId/forum/topics/:topicId/moderation') @UseGuards(JwtAccessGuard)
  moderateForumTopic(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Param('topicId') topicId: string, @Body() body: ForumModerationDto) { const { profileId, ...changes } = body; return this.domain.moderateCommunityForumTopic(u.id, id, topicId, profileId, changes) }
  @Delete('communities/:communityId/forum/topics/:topicId') @UseGuards(JwtAccessGuard)
  async deleteForumTopic(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Param('topicId') topicId: string, @Body() body: ForumActorDto) { await this.domain.deleteCommunityForumTopic(u.id, id, topicId, body.profileId); return { success: true } }
  @Delete('communities/:communityId/forum/replies/:replyId') @UseGuards(JwtAccessGuard)
  async deleteForumReply(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Param('replyId') replyId: string, @Body() body: ForumActorDto) { await this.domain.deleteCommunityForumReply(u.id, id, replyId, body.profileId); return { success: true } }

  @Get('relationships') @UseGuards(JwtAccessGuard) getRelationships(@CurrentUser() u: AuthenticatedUserContext, @Query('profileId') id: string) { return this.domain.getProfileRelationships(u.id, id) }
  @Get('relationships/friends/:profileId') getFriends(@Param('profileId') id: string, @Query() q: PaginationDto) { return this.domain.getProfileFriends(id, q) }
  @Post('relationships') @UseGuards(JwtAccessGuard) updateRelationship(@CurrentUser() u: AuthenticatedUserContext, @Body() body: ProfileRelationDto) {
    return this.domain.updateProfileRelationship(u.id, body.sourceProfileId, body.targetProfileId, body.type)
  }
  @Post('relationships/remove') @UseGuards(JwtAccessGuard) async removeRelationship(@CurrentUser() u: AuthenticatedUserContext, @Body() body: Omit<ProfileRelationDto, 'type'>) {
    await this.domain.removeProfileRelationship(u.id, body.sourceProfileId, body.targetProfileId); return { success: true }
  }

  @Get('communities/:communityId/relationships')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityRelationships(@Param('communityId') id: string, @CurrentUser() u: AuthenticatedUserContext | undefined) {
    return this.domain.getCommunityRelationships(u?.id ?? null, id)
  }

  @Get('communities/:communityId/members/pending') @UseGuards(JwtAccessGuard) pendingMembers(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') id: string, @Query('actorProfileId') actor: string, @Query() q: PaginationDto) {
    return this.domain.listPendingMembers(u.id, id, actor, q)
  }

  @Get('communities/:communityId/members')
  @UseGuards(OptionalJwtAccessGuard)
  members(@Param('communityId') id: string, @Query('tab') tab: string | undefined, @CurrentUser() u: AuthenticatedUserContext | undefined, @Query() q: PaginationDto) {
    return this.domain.listCommunityMembers(id, tab ?? 'all', q, u?.id ?? null, q.actorProfileId)
  }

  @Post('communities/:communityId/relationships/:profileId') @UseGuards(JwtAccessGuard) updateCommunityRelationship(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') cid: string, @Param('profileId') pid: string, @Body() body: CommunityRelationDto) {
    return this.domain.updateCommunityRelationship(u.id, cid, pid, body.actorProfileId, body.type)
  }
  @Post('communities/:communityId/relationships/:profileId/remove') @UseGuards(JwtAccessGuard) async removeCommunityRelationship(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') cid: string, @Param('profileId') pid: string, @Body() body: ActorDto) {
    await this.domain.removeCommunityRelationship(u.id, cid, pid, body.actorProfileId); return { success: true }
  }
  @Post('communities/:communityId/moderators/:profileId/demote') @UseGuards(JwtAccessGuard) async demoteModerator(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') cid: string, @Param('profileId') pid: string, @Body() body: ActorDto) {
    await this.domain.demoteModerator(u.id, cid, pid, body.actorProfileId); return { success: true }
  }
  @Post('communities/:communityId/ownership-transfer') @UseGuards(JwtAccessGuard) async transferOwnership(@CurrentUser() u: AuthenticatedUserContext, @Param('communityId') cid: string, @Body() body: OwnershipDto) {
    await this.domain.transferOwnership(u.id, cid, body.newOwnerProfileId, body.actorProfileId); return { success: true }
  }

  @Get('profiles/:profileId/messages') @UseGuards(OptionalJwtAccessGuard) messages(@Param('profileId') id: string, @CurrentUser() u: AuthenticatedUserContext | undefined, @Query() q: PaginationDto) {
    return this.domain.getMessages(id, u?.id ?? null, q)
  }
  @Post('profiles/:profileId/messages') @UseGuards(JwtAccessGuard) sendMessage(@CurrentUser() u: AuthenticatedUserContext, @Param('profileId') id: string, @Body() body: MessageDto) {
    return this.domain.sendMessage(u.id, body.fromProfileId, id, body.content)
  }
}
