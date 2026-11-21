import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { PaginationDto } from '../pagination/pagination.dto'
import { ActorDto, CommunityRelationDto, OwnershipDto, ProfileRelationDto, RemoveProfileRelationDto } from './domain.dto'
import { DomainService } from './domain.service'

@Controller()
export class RelationshipsController {
  constructor(private readonly domain: DomainService) {}

  @Get('relationships')
  @UseGuards(JwtAccessGuard)
  getRelationships(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('profileId', new ParseUUIDPipe()) id: string
  ) {
    return this.domain.getProfileRelationships(user.id, id)
  }

  @Get('relationships/friends/:profileId')
  getFriends(@Param('profileId', new ParseUUIDPipe()) id: string, @Query() query: PaginationDto) {
    return this.domain.getProfileFriends(id, query)
  }

  @Post('relationships')
  @UseGuards(JwtAccessGuard)
  updateRelationship(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: ProfileRelationDto
  ) {
    return this.domain.updateProfileRelationship(
      user.id,
      body.sourceProfileId,
      body.targetProfileId,
      body.type
    )
  }

  @Post('relationships/remove')
  @UseGuards(JwtAccessGuard)
  async removeRelationship(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: RemoveProfileRelationDto
  ) {
    await this.domain.removeProfileRelationship(user.id, body.sourceProfileId, body.targetProfileId)
    return { success: true }
  }

  @Get('communities/:communityId/relationships')
  @UseGuards(OptionalJwtAccessGuard)
  getCommunityRelationships(
    @Param('communityId', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.domain.getCommunityRelationships(user?.id ?? null, id)
  }

  @Get('communities/:communityId/members/pending')
  @UseGuards(JwtAccessGuard)
  pendingMembers(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId', new ParseUUIDPipe()) id: string,
    @Query('actorProfileId', new ParseUUIDPipe()) actor: string,
    @Query() query: PaginationDto
  ) {
    return this.domain.listPendingMembers(user.id, id, actor, query)
  }

  @Get('communities/:communityId/members')
  @UseGuards(OptionalJwtAccessGuard)
  members(
    @Param('communityId', new ParseUUIDPipe()) id: string,
    @Query('tab') tab: string | undefined,
    @CurrentUser() user: AuthenticatedUserContext | undefined,
    @Query() query: PaginationDto
  ) {
    return this.domain.listCommunityMembers(
      id,
      tab ?? 'all',
      query,
      user?.id ?? null,
      query.actorProfileId
    )
  }

  @Post('communities/:communityId/relationships/:profileId')
  @UseGuards(JwtAccessGuard)
  updateCommunityRelationship(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId', new ParseUUIDPipe()) communityId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body() body: CommunityRelationDto
  ) {
    return this.domain.updateCommunityRelationship(
      user.id,
      communityId,
      profileId,
      body.actorProfileId,
      body.type
    )
  }

  @Post('communities/:communityId/relationships/:profileId/remove')
  @UseGuards(JwtAccessGuard)
  async removeCommunityRelationship(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId', new ParseUUIDPipe()) communityId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body() body: ActorDto
  ) {
    await this.domain.removeCommunityRelationship(
      user.id,
      communityId,
      profileId,
      body.actorProfileId
    )
    return { success: true }
  }

  @Post('communities/:communityId/moderators/:profileId/demote')
  @UseGuards(JwtAccessGuard)
  async demoteModerator(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId', new ParseUUIDPipe()) communityId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body() body: ActorDto
  ) {
    await this.domain.demoteModerator(user.id, communityId, profileId, body.actorProfileId)
    return { success: true }
  }

  @Post('communities/:communityId/ownership-transfer')
  @UseGuards(JwtAccessGuard)
  async transferOwnership(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('communityId', new ParseUUIDPipe()) communityId: string,
    @Body() body: OwnershipDto
  ) {
    await this.domain.transferOwnership(
      user.id,
      communityId,
      body.newOwnerProfileId,
      body.actorProfileId
    )
    return { success: true }
  }
}
