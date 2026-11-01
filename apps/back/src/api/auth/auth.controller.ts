import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'
import type { AuthTokenPair, UserPreferences } from '@nexus/common'
import { AuthService } from './auth.service'
import { CurrentUser } from './current-user.decorator'
import { JwtAccessGuard } from './jwt-access.guard'

class CredentialsDto {
  @IsEmail() email!: string
  @IsString() @MinLength(1) password!: string
}
class SignUpDto {
  @IsEmail() email!: string
  @IsString() @MinLength(8) password!: string
}
class RefreshDto { @IsString() refreshToken!: string }
class CurrentProfileDto { @IsString() profileId!: string }
class PreferencesDto implements Partial<UserPreferences> {
  @IsOptional() @IsIn(['system', 'pt-BR', 'en-US']) language?: UserPreferences['language']
  @IsOptional() @IsIn(['system', 'light', 'dark']) theme?: UserPreferences['theme']
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('sign-up') signUp(@Body() body: SignUpDto): Promise<AuthTokenPair> { return this.auth.signUp(body) }
  @Post('sign-in') signIn(@Body() body: CredentialsDto): Promise<AuthTokenPair> { return this.auth.signIn(body) }
  @Post('refresh') refresh(@Body() body: RefreshDto): Promise<AuthTokenPair> { return this.auth.refresh(body.refreshToken) }
  @Post('sign-out') async signOut(@Body() body: RefreshDto): Promise<{ success: true }> { await this.auth.signOut(body.refreshToken); return { success: true } }
  @Get('me') @UseGuards(JwtAccessGuard) async me(@CurrentUser() user: { id: string }) { return { user: await this.auth.getUser(user.id) } }
  @Get('preferences') @UseGuards(JwtAccessGuard) async getPreferences(@CurrentUser() user: { id: string }) { return this.auth.getPreferences(user.id) }
  @Post('preferences') @UseGuards(JwtAccessGuard) async updatePreferences(@CurrentUser() user: { id: string }, @Body() body: PreferencesDto) { return this.auth.updatePreferences(user.id, body) }
  @Post('current-profile') @UseGuards(JwtAccessGuard) async currentProfile(@CurrentUser() user: { id: string }, @Body() body: CurrentProfileDto) { return { user: await this.auth.updateCurrentProfile(user.id, body.profileId) } }
}
