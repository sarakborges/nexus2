import type { AuthenticatedUser } from '@nexus/common'
export type AccountRecord = AuthenticatedUser & { password: { hash: string; salt: string } }
export type RefreshTokenRecord = { id: string; userId: string; tokenHash: string; expiresAt: number }
export type JwtPayload = { sub: string; email: string; type: 'access' | 'refresh'; jti?: string }
