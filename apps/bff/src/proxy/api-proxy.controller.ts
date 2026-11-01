import { All, Controller, HttpStatus, Logger, Req, Res } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import type { AxiosRequestConfig, Method } from 'axios'
import type { Request, Response } from 'express'
import { ACCESS_COOKIE, getCookie, REFRESH_COOKIE, writeAuthCookies } from '../auth/cookie.util'

type AuthTokenPair = { accessToken: string; refreshToken: string }

@Controller('api')
export class ApiProxyController {
  private readonly logger = new Logger(ApiProxyController.name)
  private readonly backUrl = process.env.BACKEND_URL ?? 'http://localhost:3002/api'
  constructor(private readonly http: HttpService) {}

  @All('{*path}')
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const accessToken = getCookie(req, ACCESS_COOKIE)
    const refreshToken = getCookie(req, REFRESH_COOKIE)
    const headers: Record<string, string> = {}
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    // Axios receives a params object: arrays and repeated query keys are serialized centrally.
    const config: AxiosRequestConfig = {
      url: `${this.backUrl}${req.path}`,
      method: req.method as Method,
      params: req.query,
      data: req.body,
      headers,
      validateStatus: () => true
    }

    try {
      let result = await this.http.axiosRef.request(config)
      if (result.status === HttpStatus.UNAUTHORIZED && refreshToken) {
        const refreshed = await this.refreshTokens(refreshToken, res)
        if (refreshed) {
          result = await this.http.axiosRef.request({
            ...config,
            headers: { ...headers, Authorization: `Bearer ${refreshed.accessToken}` }
          })
        }
      }
      res.status(result.status).send(result.data)
    } catch (error) {
      this.logger.error('BFF could not forward request to the domain API.', error)
      res.status(HttpStatus.BAD_GATEWAY).json({ statusCode: HttpStatus.BAD_GATEWAY, message: 'BACKEND_UNAVAILABLE' })
    }
  }

  private async refreshTokens(token: string, res: Response): Promise<AuthTokenPair | null> {
    try {
      const { data } = await this.http.axiosRef.post<AuthTokenPair>(`${this.backUrl}/auth/refresh`, { refreshToken: token })
      writeAuthCookies(res, data.accessToken, data.refreshToken)
      return data
    } catch { return null }
  }
}
