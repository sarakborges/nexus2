import { All, Controller, HttpStatus, Logger, Req, Res } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import axios, { type AxiosRequestConfig, type Method } from 'axios'
import type { Request, Response } from 'express'
import { ACCESS_COOKIE, getCookie, REFRESH_COOKIE, writeAuthCookies } from '../auth/cookie.util'
import { getBackendUrl } from '../backend-url.util'

type AuthTokenPair = { accessToken: string; refreshToken: string }

@Controller('api')
export class ApiProxyController {
  private readonly logger = new Logger(ApiProxyController.name)
  private readonly backUrl = getBackendUrl()
  private readonly refreshInFlight = new Map<string, Promise<AuthTokenPair | null>>()
  constructor(private readonly http: HttpService) {}

  @All('{*path}')
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    let accessToken = getCookie(req, ACCESS_COOKIE)
    const refreshToken = getCookie(req, REFRESH_COOKIE)
    try {
      // Refresh the short-lived access cookie before forwarding when possible.
      if (!accessToken && refreshToken) {
        const refreshed = await this.refreshTokens(refreshToken, res)
        accessToken = refreshed?.accessToken ?? null
      }

      const headers: Record<string, string> = {}
      const isCleanupCron = req.path === '/api/internal/cleanup-uploads'
      const isBinaryImage = /^\/api\/uploads\/[0-9a-f-]{36}\/content$/i.test(req.path)

      if (isCleanupCron) {
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret || req.headers.authorization !== 'Bearer ' + cronSecret) {
          res.status(HttpStatus.UNAUTHORIZED).json({ statusCode: HttpStatus.UNAUTHORIZED, message: 'CRON_UNAUTHORIZED' })
          return
        }
        headers['x-nexus-cron-secret'] = cronSecret
      } else if (accessToken) {
        headers.Authorization = 'Bearer ' + accessToken
      }
      // Vercel forwards the original /api path to this service. BACKEND_URL
      // already contains /api, so only the path after that prefix is appended.
      const backendPath = req.path.replace(/^\/api(?=\/|$)/, '')
      const config: AxiosRequestConfig = {
        url: `${this.backUrl}${backendPath}`,
        method: req.method as Method,
        params: req.query,
        data: req.body,
        headers,
        responseType: isBinaryImage ? 'arraybuffer' : 'json',
        validateStatus: () => true
      }

      let result = await this.http.axiosRef.request(config)
      if (result.status === HttpStatus.UNAUTHORIZED && refreshToken && accessToken) {
        const refreshed = await this.refreshTokens(refreshToken, res)
        if (refreshed) {
          result = await this.http.axiosRef.request({
            ...config,
            headers: { ...headers, Authorization: `Bearer ${refreshed.accessToken}` }
          })
        }
      }
      if (isBinaryImage) {
        for (const header of ['content-type', 'content-length', 'cache-control', 'x-content-type-options']) {
          const value = result.headers[header]
          if (typeof value === 'string') res.setHeader(header, value)
        }
      }
      res.status(result.status).send(result.data)
    } catch (error) {
      this.logger.error('BFF could not forward request to the domain API.', error)
      res.status(HttpStatus.BAD_GATEWAY).json({ statusCode: HttpStatus.BAD_GATEWAY, message: 'BACKEND_UNAVAILABLE' })
    }
  }

  private async refreshTokens(token: string, res: Response): Promise<AuthTokenPair | null> {
    let refresh = this.refreshInFlight.get(token)

    if (!refresh) {
      refresh = this.http.axiosRef
        .post<AuthTokenPair>(`${this.backUrl}/auth/refresh`, { refreshToken: token })
        .then(response => response.data)
        .catch(error => {
          // Only a definitive invalid/revoked refresh token means the user
          // must authenticate again. A timeout or backend 5xx is transient.
          if (
            axios.isAxiosError(error) &&
            [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN].includes(error.response?.status ?? 0)
          ) {
            return null
          }
          throw error
        })

      this.refreshInFlight.set(token, refresh)
      void refresh.finally(() => {
        if (this.refreshInFlight.get(token) === refresh) {
          this.refreshInFlight.delete(token)
        }
      }).catch(() => undefined)
    }

    const tokens = await refresh
    if (tokens) writeAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    return tokens
  }
}
