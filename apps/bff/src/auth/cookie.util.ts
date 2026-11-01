import type { Request, Response } from 'express'

export const ACCESS_COOKIE = 'nexus_access'
export const REFRESH_COOKIE = 'nexus_refresh'

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie
  if (!header) return null
  const prefix = `${name}=`
  const entry = header.split(';').map(value => value.trim()).find(value => value.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null
}

export function writeAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
  const common = ['Path=/api', 'HttpOnly', 'SameSite=Lax', 'Priority=High', ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])].join('; ')
  response.setHeader('Set-Cookie', [
    `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; ${common}; Max-Age=${process.env.JWT_ACCESS_TTL_SECONDS ?? '900'}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; ${common}; Max-Age=${process.env.JWT_REFRESH_TTL_SECONDS ?? '2592000'}`
  ])
}

export function clearAuthCookies(response: Response): void {
  const common = ['Path=/api', 'HttpOnly', 'SameSite=Lax', ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])].join('; ')
  response.setHeader('Set-Cookie', [
    `${ACCESS_COOKIE}=; ${common}; Max-Age=0`,
    `${REFRESH_COOKIE}=; ${common}; Max-Age=0`
  ])
}
