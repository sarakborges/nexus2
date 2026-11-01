import type { AuthenticatedUser, UserPreferences } from '@nexus/common'
export type AccountRecord = AuthenticatedUser & { password: { hash: string; salt: string }; preferences?: UserPreferences }
export type RefreshTokenRecord = { id: string; userId: string; tokenHash: string; expiresAt: number }
export type JwtPayload = { sub: string; email: string; type: 'access' | 'refresh'; jti?: string }
