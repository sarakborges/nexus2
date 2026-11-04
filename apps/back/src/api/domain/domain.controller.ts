import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import type { CommunityPrivacy, CreateCommunityInput, CreateProfileInput, CommunityRelationshipType, RelationshipType } from '@nexus/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { PaginationDto } from '../pagination/pagination.dto'
import { DomainService } from './domain.service'

class CreateProfileDto implements CreateProfileInput {
  @IsString() @MaxLength(80) name!: string
  @IsOptional() @IsString() url?: string
  @IsString() picture!: string
  @IsString() @MaxLength(12000) about!: string
  @IsIn(['social', 'rp', 'business']) type!: 'social' | 'rp' | 'business'
}
class UpdateProfileDto implements Omit<CreateProfileInput, 'type'> {
  @IsString() @MaxLength(80) name!: string
  @IsOptional() @IsString() url?: string
  @IsString() picture!: string
  @IsString() @MaxLength(12000) about!: string
}
class CreateCommunityDto implements CreateCommunityInput {
  @IsString() @MaxLength(80) name!: string
  @IsOptional() @IsString() url?: string
  @IsString() picture!: string
  @IsString() @MaxLength(12000) about!: string
  @IsIn(['public', 'private', 'unlisted']) privacy!: CommunityPrivacy
  @IsString() ownerProfileId!: string
}
class UpdateCommunityDto implements CreateCommunityInput {
  @IsString() @MaxLength(80) name!: string
  @IsOptional() @IsString() url?: string
  @IsString() picture!: string
  @IsString() @MaxLength(12000) about!: string
  @IsIn(['public', 'private', 'unlisted']) privacy!: CommunityPrivacy
}
class ProfileRelationDto {
  @IsString() sourceProfileId!: string
  @IsString() targetProfileId!: string
  @IsIn(['connection', 'requested', 'blocked']) type!: RelationshipType
}
class CommunityRelationDto {
  @IsString() actorProfileId!: string
  @IsIn(['connection', 'requested', 'blocked', 'moderator']) type!: CommunityRelationshipType
}
class ActorDto { @IsString() actorProfileId!: string }
class OwnershipDto extends ActorDto { @IsString() newOwnerProfileId!: string }
class MessageDto {
  @IsString() fromProfileId!: string
  @IsString() @MinLength(1) @MaxLength(12000) content!: string
}
class CreateForumTopicDto { @IsString() profileId!: string; @IsString() @MinLength(1) @MaxLength(140) title!: string; @IsString() @MinLength(1) @MaxLength(12000) content!: string }
class CreateForumReplyDto { @IsString() profileId!: string; @IsString() @MinLength(1) @MaxLength(12000) content!: string }
class ForumActorDto { @IsString() profileId!: string }
class ForumModerationDto extends ForumActorDto { @IsOptional() @IsBoolean() isPinned?: boolean; @IsOptional() @IsBoolean() isLocked?: boolean }

@Controller()
export class DomainController {
  constructor(private readonly domain: DomainService) {}

  @Get('activity') @UseGuards(JwtAccessGuard) recentActivity(@CurrentUser() u: { id: string }) { return this.domain.getRecentActivity(u.id) }

  @Get('profiles') listProfiles(@Query() q: PaginationDto) { return this.domain.listProfiles(q) }
  @Get('profiles/owned') @UseGuards(JwtAccessGuard) ownedProfiles(@CurrentUser() u: { id: string }, @Query() q: PaginationDto) { return this.domain.listOwnedProfiles(u.id, q) }
  @Get('profiles/by-url/:url') getProfile(@Param('url') url: string) { return this.domain.getProfile(url) }
  @Get('profiles/ids') getProfiles(@Query('ids') ids: string | string[]) { return this.domain.getProfilesByIds(Array.isArray(ids) ? ids : ids ? [ids] : []) }
  @Post('profiles') @UseGuards(JwtAccessGuard) createProfile(@CurrentUser() u: { id: string }, @Body() body: CreateProfileDto) { return this.domain.createProfile(u.id, body) }
  @Put('profiles/:profileId') @UseGuards(JwtAccessGuard) updateProfile(@CurrentUser() u: { id: string }, @Param('profileId') id: string, @Body() body: UpdateProfileDto) { return this.domain.updateProfile(u.id, id, body) }

  @Get('communities') listCommunities(@Query() q: PaginationDto) { return this.domain.listCommunities(q) }
  @Get('communities/by-url/:url') @UseGuards(OptionalJwtAccessGuard)
  getCommunity(@Param('url') url: string, @CurrentUser() u: { id: string } | undefined) { return this.domain.getCommunity(url, u?.id ?? null) }
  @Get('communities/ids') getCommunities(@Query('ids') ids: string | string[]) { return this.domain.getCommunitiesByIds(Array.isArray(ids) ? ids : ids ? [ids] : []) }
  @Get('communities/profile/:profileId') profileCommunities(@Param('profileId') id: string, @Query() q: PaginationDto) { return this.domain.listProfileCommunities(id, q) }
  @Post('communities') @UseGuards(JwtAccessGuard) createCommunity(@CurrentUser() u: { id: string }, @Body() body: CreateCommunityDto) {
    const { ownerProfileId, ...community } = body
    return this.domain.createCommunity(u.id, ownerProfileId, community)
  }
  @Put('communities/:communityId') @UseGuards(JwtAccessGuard) updateCommunity(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Body() body: UpdateCommunityDto) {
    return this.domain.updateCommunity(u.id, id, body)
  }


  @Get('communities/:communityId/forum/topics') @UseGuards(OptionalJwtAccessGuard)
  forumTopics(@Param('communityId') id: string, @Query() q: PaginationDto, @CurrentUser() u: { id: string } | undefined) { return this.domain.listCommunityForumTopics(id, q, u?.id ?? null) }
  @Get('communities/:communityId/forum/topics/:topicId') @UseGuards(OptionalJwtAccessGuard)
  forumTopic(@Param('communityId') id: string, @Param('topicId') topicId: string, @Query() q: PaginationDto, @CurrentUser() u: { id: string } | undefined) { return this.domain.getCommunityForumTopic(id, topicId, q, u?.id ?? null) }
  @Post('communities/:communityId/forum/topics') @UseGuards(JwtAccessGuard)
  createForumTopic(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Body() body: CreateForumTopicDto) { return this.domain.createCommunityForumTopic(u.id, id, body.profileId, body.title, body.content) }
  @Post('communities/:communityId/forum/topics/:topicId/replies') @UseGuards(JwtAccessGuard)
  createForumReply(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Param('topicId') topicId: string, @Body() body: CreateForumReplyDto) { return this.domain.createCommunityForumReply(u.id, id, topicId, body.profileId, body.content) }
  @Put('communities/:communityId/forum/topics/:topicId/moderation') @UseGuards(JwtAccessGuard)
  moderateForumTopic(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Param('topicId') topicId: string, @Body() body: ForumModerationDto) { const { profileId, ...changes } = body; return this.domain.moderateCommunityForumTopic(u.id, id, topicId, profileId, changes) }
  @Delete('communities/:communityId/forum/topics/:topicId') @UseGuards(JwtAccessGuard)
  async deleteForumTopic(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Param('topicId') topicId: string, @Body() body: ForumActorDto) { await this.domain.deleteCommunityForumTopic(u.id, id, topicId, body.profileId); return { success: true } }
  @Delete('communities/:communityId/forum/replies/:replyId') @UseGuards(JwtAccessGuard)
  async deleteForumReply(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Param('replyId') replyId: string, @Body() body: ForumActorDto) { await this.domain.deleteCommunityForumReply(u.id, id, replyId, body.profileId); return { success: true } }

  @Get('relationships') @UseGuards(JwtAccessGuard) getRelationships(@CurrentUser() u: { id: string }, @Query('profileId') id: string) { return this.domain.getProfileRelationships(u.id, id) }
  @Get('relationships/friends/:profileId') getFriends(@Param('profileId') id: string, @Query() q: PaginationDto) { return this.domain.getProfileFriends(id, q) }
  @Post('relationships') @UseGuards(JwtAccessGuard) updateRelationship(@CurrentUser() u: { id: string }, @Body() body: ProfileRelationDto) {
    return this.domain.updateProfileRelationship(u.id, body.sourceProfileId, body.targetProfileId, body.type)
  }
  @Post('relationships/remove') @UseGuards(JwtAccessGuard) async removeRelationship(@CurrentUser() u: { id: string }, @Body() body: Omit<ProfileRelationDto, 'type'>) {
    await this.domain.removeProfileRelationship(u.id, body.sourceProfileId, body.targetProfileId); return { success: true }
  }

  @Get('communities/:communityId/relationships')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityRelationships(@Param('communityId') id: string, @CurrentUser() u: { id: string } | undefined) {
    return this.domain.getCommunityRelationships(u?.id ?? null, id)
  }

  @Get('communities/:communityId/members/pending') @UseGuards(JwtAccessGuard) pendingMembers(@CurrentUser() u: { id: string }, @Param('communityId') id: string, @Query('actorProfileId') actor: string, @Query() q: PaginationDto) {
    return this.domain.listPendingMembers(u.id, id, actor, q)
  }

  @Get('communities/:communityId/members')
  @UseGuards(OptionalJwtAccessGuard)
  members(@Param('communityId') id: string, @Query('tab') tab: string | undefined, @CurrentUser() u: { id: string } | undefined, @Query() q: PaginationDto) {
    return this.domain.listCommunityMembers(id, tab ?? 'all', q, u?.id ?? null, q.actorProfileId)
  }

  @Post('communities/:communityId/relationships/:profileId') @UseGuards(JwtAccessGuard) updateCommunityRelationship(@CurrentUser() u: { id: string }, @Param('communityId') cid: string, @Param('profileId') pid: string, @Body() body: CommunityRelationDto) {
    return this.domain.updateCommunityRelationship(u.id, cid, pid, body.actorProfileId, body.type)
  }
  @Post('communities/:communityId/relationships/:profileId/remove') @UseGuards(JwtAccessGuard) async removeCommunityRelationship(@CurrentUser() u: { id: string }, @Param('communityId') cid: string, @Param('profileId') pid: string, @Body() body: ActorDto) {
    await this.domain.removeCommunityRelationship(u.id, cid, pid, body.actorProfileId); return { success: true }
  }
  @Post('communities/:communityId/moderators/:profileId/demote') @UseGuards(JwtAccessGuard) async demoteModerator(@CurrentUser() u: { id: string }, @Param('communityId') cid: string, @Param('profileId') pid: string, @Body() body: ActorDto) {
    await this.domain.demoteModerator(u.id, cid, pid, body.actorProfileId); return { success: true }
  }
  @Post('communities/:communityId/ownership-transfer') @UseGuards(JwtAccessGuard) async transferOwnership(@CurrentUser() u: { id: string }, @Param('communityId') cid: string, @Body() body: OwnershipDto) {
    await this.domain.transferOwnership(u.id, cid, body.newOwnerProfileId, body.actorProfileId); return { success: true }
  }

  @Get('profiles/:profileId/messages') @UseGuards(OptionalJwtAccessGuard) messages(@Param('profileId') id: string, @CurrentUser() u: { id: string } | undefined, @Query() q: PaginationDto) {
    return this.domain.getMessages(id, u?.id ?? null, q)
  }
  @Post('profiles/:profileId/messages') @UseGuards(JwtAccessGuard) sendMessage(@CurrentUser() u: { id: string }, @Param('profileId') id: string, @Body() body: MessageDto) {
    return this.domain.sendMessage(u.id, body.fromProfileId, id, body.content)
  }
}
