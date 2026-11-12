import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import type { AuthTokenPair } from '@nexus/common'
import { AuthService } from './auth.service'
import type { AuthenticatedUserContext } from './auth.types'
import { CurrentUser } from './current-user.decorator'
import { JwtAccessGuard } from './jwt-access.guard'
import { AuthMeService } from './auth-me.service'

import {
  CredentialsDto,
  CurrentProfileDto,
  PreferencesDto,
  RefreshDto,
  SignUpDto
} from './auth.dto'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly meService: AuthMeService
  ) {}
  @Post('sign-up') signUp(@Body() body: SignUpDto): Promise<AuthTokenPair> { return this.auth.signUp(body) }
  @Post('sign-in') signIn(@Body() body: CredentialsDto): Promise<AuthTokenPair> { return this.auth.signIn(body) }
  @Post('refresh') refresh(@Body() body: RefreshDto): Promise<AuthTokenPair> { return this.auth.refresh(body.refreshToken) }
  @Post('sign-out') async signOut(@Body() body: RefreshDto): Promise<{ success: true }> { await this.auth.signOut(body.refreshToken); return { success: true } }
  @Get('me') @UseGuards(JwtAccessGuard)
  me(@CurrentUser() user: AuthenticatedUserContext) {
    return this.meService.getMe(user.id)
  }
  @Get('preferences') @UseGuards(JwtAccessGuard) async getPreferences(@CurrentUser() user: AuthenticatedUserContext) { return this.auth.getPreferences(user.id) }
  @Post('preferences') @UseGuards(JwtAccessGuard) async updatePreferences(@CurrentUser() user: AuthenticatedUserContext, @Body() body: PreferencesDto) { return this.auth.updatePreferences(user.id, body) }
  @Post('current-profile') @UseGuards(JwtAccessGuard) async currentProfile(@CurrentUser() user: AuthenticatedUserContext, @Body() body: CurrentProfileDto) { return { user: await this.auth.updateCurrentProfile(user.id, body.profileId) } }
}
