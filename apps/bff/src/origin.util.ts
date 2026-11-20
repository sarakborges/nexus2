import { ForbiddenException } from '@nestjs/common'
import type { Request } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * SameSite=Lax does not block requests from a different origin on the same
 * site. Validate Origin for every unsafe browser-facing BFF request so a
 * sibling subdomain cannot submit cookie-authenticated form requests.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return

  const suppliedOrigin = request.headers.origin
  if (typeof suppliedOrigin !== 'string') {
    throw new ForbiddenException('CSRF_ORIGIN_INVALID')
  }

  let origin: URL
  try {
    origin = new URL(suppliedOrigin)
  } catch {
    throw new ForbiddenException('CSRF_ORIGIN_INVALID')
  }

  if (
    origin.origin === 'null' ||
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username.length > 0 ||
    origin.password.length > 0
  ) {
    throw new ForbiddenException('CSRF_ORIGIN_INVALID')
  }

  const configuredOrigin = process.env.FRONTEND_ORIGIN?.trim()
  if (configuredOrigin) {
    try {
      if (new URL(configuredOrigin).origin === origin.origin) return
    } catch {
      // An invalid configured origin is not an allow-list entry.
    }
  }

  const host = request.headers.host
  const forwardedProtocol = request.headers['x-forwarded-proto']
  const protocol = (
    Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol
  )?.split(',')[0]?.trim() || request.protocol

  if (!host || !['http', 'https'].includes(protocol)) {
    throw new ForbiddenException('CSRF_ORIGIN_INVALID')
  }

  let requestOrigin: string
  try {
    requestOrigin = new URL(`${protocol}://${host}`).origin
  } catch {
    throw new ForbiddenException('CSRF_ORIGIN_INVALID')
  }

  if (requestOrigin !== origin.origin) {
    throw new ForbiddenException('CSRF_ORIGIN_INVALID')
  }
}
