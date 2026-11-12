import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthenticatedUserContext } from '../auth/auth.types'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { PaginationDto } from '../pagination/pagination.dto'
import { CreateProfileDto, UpdateProfileDto } from './domain.dto'
import { DomainService } from './domain.service'
import { ProfilePageService } from './profile-page.service'
import { ProfileDirectoryPageService } from './profile-directory-page.service'
import { ProfileEditPageService } from './profile-edit-page.service'
import { ProfileSettingsService } from './profile-settings.service'
import { UpdateProfileSettingsDto } from './profile-settings.dto'

@Controller()
export class ProfilesController {
  constructor(
    private readonly domain: DomainService,
    private readonly profilePage: ProfilePageService,
    private readonly profileDirectoryPage: ProfileDirectoryPageService,
    private readonly profileEditPage: ProfileEditPageService,
    private readonly profileSettings: ProfileSettingsService
  ) {}

  @Get('profiles/by-url/:url/directory/:kind/page')
  @UseGuards(OptionalJwtAccessGuard)
  getProfileDirectoryPage(
    @Param('url') url: string,
    @Param('kind') kind: string,
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.profileDirectoryPage.getProfileDirectoryPage(url, kind, query, user?.id ?? null)
  }

  @Get('profiles/by-url/:url/edit/page')
  @UseGuards(OptionalJwtAccessGuard)
  getProfileEditPage(
    @Param('url') url: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.profileEditPage.getProfileEditPage(url, user?.id ?? null)
  }

  @Get('profiles/by-url/:url/page')
  @UseGuards(OptionalJwtAccessGuard)
  getProfilePage(
    @Param('url') url: string,
    @CurrentUser() user: AuthenticatedUserContext | undefined
  ) {
    return this.profilePage.getProfilePage(url, user?.id ?? null)
  }

  @Get('profiles/:profileId/settings')
  @UseGuards(JwtAccessGuard)
  getProfileSettings(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') profileId: string
  ) {
    return this.profileSettings.getSettings(user.id, profileId)
  }

  @Put('profiles/:profileId/settings')
  @UseGuards(JwtAccessGuard)
  updateProfileSettings(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') profileId: string,
    @Body() body: UpdateProfileSettingsDto
  ) {
    return this.profileSettings.updateSettings(user.id, profileId, body)
  }

  @Get('profiles')
  listProfiles(@Query() query: PaginationDto) {
    return this.domain.listProfiles(query)
  }

  @Get('profiles/owned')
  @UseGuards(JwtAccessGuard)
  ownedProfiles(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() query: PaginationDto
  ) {
    return this.domain.listOwnedProfiles(user.id, query)
  }

  @Get('profiles/by-url/:url')
  getProfile(@Param('url') url: string) {
    return this.domain.getProfile(url)
  }

  @Get('profiles/ids')
  getProfiles(@Query('ids') ids: string | string[]) {
    return this.domain.getProfilesByIds(Array.isArray(ids) ? ids : ids ? [ids] : [])
  }

  @Post('profiles')
  @UseGuards(JwtAccessGuard)
  createProfile(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: CreateProfileDto
  ) {
    return this.domain.createProfile(user.id, body)
  }

  @Put('profiles/:profileId')
  @UseGuards(JwtAccessGuard)
  updateProfile(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('profileId') id: string,
    @Body() body: UpdateProfileDto
  ) {
    return this.domain.updateProfile(user.id, id, body)
  }
}
