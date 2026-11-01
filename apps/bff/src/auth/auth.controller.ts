import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import axios from 'axios'
import { IsEmail, IsString, MinLength } from 'class-validator'
import type { Request, Response } from 'express'
import type { AuthTokenPair } from '@nexus/common'
import { clearAuthCookies, getCookie, REFRESH_COOKIE, writeAuthCookies } from './cookie.util'
import { getBackendUrl } from '../backend-url.util'

class CredentialsDto {
  @IsEmail() email!: string
  @IsString() @MinLength(1) password!: string
}
class SignUpDto {
  @IsEmail() email!: string
  @IsString() @MinLength(8) password!: string
}
type AuthResponse = { user: AuthTokenPair['user']; authenticated: true }

@Controller('api/auth')
export class AuthController {
  private readonly backUrl = getBackendUrl()
  constructor(private readonly http: HttpService) {}

  @Post('sign-up')
  async signUp(@Body() body: SignUpDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.authenticate('sign-up', body, res)
  }
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: CredentialsDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.authenticate('sign-in', body, res)
  }
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const token = getCookie(req, REFRESH_COOKIE)
    if (!token) { clearAuthCookies(res); throw new UnauthorizedException('REFRESH_TOKEN_MISSING') }
    try {
      const { data } = await this.request<AuthTokenPair>(`${this.backUrl}/auth/refresh`, { refreshToken: token })
      writeAuthCookies(res, data.accessToken, data.refreshToken)
      return { user: data.user, authenticated: true }
    } catch { clearAuthCookies(res); throw new UnauthorizedException('REFRESH_TOKEN_INVALID') }
  }
  @Post('sign-out')
  @HttpCode(200)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    const token = getCookie(req, REFRESH_COOKIE)
    try { if (token) await this.http.axiosRef.post(`${this.backUrl}/auth/sign-out`, { refreshToken: token }) }
    finally { clearAuthCookies(res) }
    return { success: true }
  }
  private async request<T>(url: string, body: unknown): Promise<{ data: T }> {
    try { return await this.http.axiosRef.post<T>(url, body) }
    catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY
        const payload = error.response?.data ?? { message: 'BACKEND_UNAVAILABLE' }
        throw new HttpException(payload, status)
      }
      throw error
    }
  }
  private async authenticate(route: 'sign-in' | 'sign-up', body: CredentialsDto | SignUpDto, res: Response): Promise<AuthResponse> {
    const { data } = await this.request<AuthTokenPair>(`${this.backUrl}/auth/${route}`, body)
    writeAuthCookies(res, data.accessToken, data.refreshToken)
    return { user: data.user, authenticated: true }
  }
}
