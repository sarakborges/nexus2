import { isIP } from 'node:net'
import type { Request } from 'express'

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for']
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const candidates = [
    forwardedValue?.split(',')[0]?.trim(),
    req.ip,
    req.socket?.remoteAddress
  ]

  for (const candidate of candidates) {
    if (candidate && isIP(candidate)) return candidate
  }

  return 'unknown'
}
