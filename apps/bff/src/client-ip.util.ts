import { isIP } from 'node:net'
import type { Request } from 'express'

function firstForwardedAddress(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header
  return value?.split(',')[0]?.trim()
}

export function getClientIp(req: Request): string {
  const vercelForwarded = firstForwardedAddress(
    req.headers['x-vercel-forwarded-for']
  )
  const forwardedValue = vercelForwarded
    ? vercelForwarded
    : firstForwardedAddress(req.headers['x-forwarded-for'])
  const candidates = [
    forwardedValue,
    req.ip,
    req.socket?.remoteAddress
  ]

  for (const candidate of candidates) {
    if (candidate && isIP(candidate)) return candidate
  }

  return 'unknown'
}
