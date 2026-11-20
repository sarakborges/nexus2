import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import { isIP } from 'node:net'
import { HttpService } from '@nestjs/axios'
import axios from 'axios'
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import type { Request, Response } from 'express'
import type { AuthTokenPair } from '@nexus/common'
import { clearAuthCookies, getCookie, REFRESH_COOKIE, writeAuthCookies } from './cookie.util'
import { getBackendUrl } from '../backend-url.util'

class CredentialsDto {
  @IsEmail() @MaxLength(254) email!: string
  @IsString() @MinLength(1) @MaxLength(128) password!: string
}
class SignUpDto {
  @IsEmail() @MaxLength(254) email!: string
  @IsString() @MinLength(8) @MaxLength(128) password!: string
}
type AuthResponse = { user: AuthTokenPair['user']; authenticated: true }

@Controller('api/auth')
export class AuthController {
  private readonly backUrl = getBackendUrl()
  constructor(private readonly http: HttpService) {}

  @Post('sign-up')
  async signUp(@Body() body: SignUpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.authenticate('sign-up', body, req, res)
  }
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: CredentialsDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.authenticate('sign-in', body, req, res)
  }
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const token = getCookie(req, REFRESH_COOKIE)
    if (!token) {
      clearAuthCookies(res)
      throw new UnauthorizedException('REFRESH_TOKEN_MISSING')
    }

    try {
      const { data } = await this.request<AuthTokenPair>(`${this.backUrl}/auth/refresh`, { refreshToken: token })
      writeAuthCookies(res, data.accessToken, data.refreshToken)
      return { user: data.user, authenticated: true }
    } catch (error) {
      // Only a definitive rejected refresh token should end the browser session.
      // A backend outage must preserve cookies so the user can retry later.
      if (error instanceof HttpException && [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN].includes(error.getStatus())) {
        clearAuthCookies(res)
        throw new UnauthorizedException('REFRESH_TOKEN_INVALID')
      }
      throw error
    }
  }
  @Post('sign-out')
  @HttpCode(200)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    const token = getCookie(req, REFRESH_COOKIE)
    try { if (token) await this.http.axiosRef.post(`${this.backUrl}/auth/sign-out`, { refreshToken: token }) }
    finally { clearAuthCookies(res) }
    return { success: true }
  }
  private async request<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ data: T }> {
    try { return await this.http.axiosRef.post<T>(url, body, { headers }) }
    catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY
        const payload = error.response?.data ?? { message: 'BACKEND_UNAVAILABLE' }
        throw new HttpException(payload, status)
      }
      throw error
    }
  }
  private async authenticate(
    route: 'sign-in' | 'sign-up',
    body: CredentialsDto | SignUpDto,
    req: Request,
    res: Response
  ): Promise<AuthResponse> {
    const { data } = await this.request<AuthTokenPair>(
      `${this.backUrl}/auth/${route}`,
      body,
      { 'x-nexus-client-ip': this.clientIp(req) }
    )
    writeAuthCookies(res, data.accessToken, data.refreshToken)
    return { user: data.user, authenticated: true }
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for']
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded
    const candidate = forwardedValue?.split(',')[0]?.trim()
      || req.ip
      || req.socket.remoteAddress
      || ''
    return isIP(candidate) ? candidate : 'unknown'
  }
}
