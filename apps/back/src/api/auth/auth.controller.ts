import { Body, Controller, Delete, Get, Headers, Post, UseGuards } from '@nestjs/common'
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
  @Post('sign-up')
  async signUp(
    @Body() body: SignUpDto,
    @Headers('x-nexus-client-ip') clientIp = 'unknown'
  ): Promise<AuthTokenPair> {
    await this.auth.assertAuthAttemptAllowed('sign-up', clientIp)
    return this.auth.signUp(body)
  }

  @Post('sign-in')
  async signIn(
    @Body() body: CredentialsDto,
    @Headers('x-nexus-client-ip') clientIp = 'unknown'
  ): Promise<AuthTokenPair> {
    await this.auth.assertAuthAttemptAllowed('sign-in', clientIp)
    return this.auth.signIn(body)
  }
  @Post('refresh') refresh(@Body() body: RefreshDto): Promise<AuthTokenPair> { return this.auth.refresh(body.refreshToken) }
  @Post('sign-out') async signOut(@Body() body: RefreshDto): Promise<{ success: true }> { await this.auth.signOut(body.refreshToken); return { success: true } }
  @Get('me') @UseGuards(JwtAccessGuard)
  me(@CurrentUser() user: AuthenticatedUserContext) {
    return this.meService.getMe(user.id)
  }
  @Delete('account') @UseGuards(JwtAccessGuard)
  async deleteAccount(@CurrentUser() user: AuthenticatedUserContext): Promise<{ success: true }> {
    await this.auth.deleteAccount(user.id)
    return { success: true }
  }
  @Get('preferences') @UseGuards(JwtAccessGuard) async getPreferences(@CurrentUser() user: AuthenticatedUserContext) { return this.auth.getPreferences(user.id) }
  @Post('preferences') @UseGuards(JwtAccessGuard) async updatePreferences(@CurrentUser() user: AuthenticatedUserContext, @Body() body: PreferencesDto) { return this.auth.updatePreferences(user.id, body) }
  @Post('current-profile') @UseGuards(JwtAccessGuard) async currentProfile(@CurrentUser() user: AuthenticatedUserContext, @Body() body: CurrentProfileDto) { return { user: await this.auth.updateCurrentProfile(user.id, body.profileId) } }
}
