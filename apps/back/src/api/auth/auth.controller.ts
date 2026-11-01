import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { IsEmail, IsString, MinLength } from 'class-validator'
import type { AuthTokenPair } from '@nexus/common'
import { AuthService } from './auth.service'
import { CurrentUser } from './current-user.decorator'
import { JwtAccessGuard } from './jwt-access.guard'

class CredentialsDto {
  @IsEmail() email!: string
  @IsString() @MinLength(8) password!: string
}
class RefreshDto { @IsString() refreshToken!: string }
class CurrentProfileDto { @IsString() profileId!: string }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('sign-up') signUp(@Body() body: CredentialsDto): Promise<AuthTokenPair> { return this.auth.signUp(body) }
  @Post('sign-in') signIn(@Body() body: CredentialsDto): Promise<AuthTokenPair> { return this.auth.signIn(body) }
  @Post('refresh') refresh(@Body() body: RefreshDto): Promise<AuthTokenPair> { return this.auth.refresh(body.refreshToken) }
  @Post('sign-out') async signOut(@Body() body: RefreshDto): Promise<{ success: true }> { await this.auth.signOut(body.refreshToken); return { success: true } }
  @Get('me') @UseGuards(JwtAccessGuard) async me(@CurrentUser() user: { id: string }) { return { user: await this.auth.getUser(user.id) } }
  @Post('current-profile') @UseGuards(JwtAccessGuard) async currentProfile(@CurrentUser() user: { id: string }, @Body() body: CurrentProfileDto) { return { user: await this.auth.updateCurrentProfile(user.id, body.profileId) } }
}
