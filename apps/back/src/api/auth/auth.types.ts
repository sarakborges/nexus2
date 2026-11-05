import type { AuthenticatedUser, UserPreferences } from '@nexus/common'
export type AccountRecord = AuthenticatedUser & { password: { hash: string; salt: string }; preferences?: UserPreferences }
export type RefreshTokenRecord = { id: string; userId: string; tokenHash: string; expiresAt: number }
export type JwtPayload = { sub: string; email: string; type: 'access' | 'refresh'; jti?: string }

export type RefreshRotation = {
  id: string
  userId: string
  tokenHash: string
}

export type TokenIssueContext =
  | { kind: 'sign-up' }
  | { kind: 'sign-in' }
  | { kind: 'refresh'; rotation: RefreshRotation }
