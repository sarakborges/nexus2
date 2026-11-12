import type { AuthenticatedUser } from '@nexus/common'
import type { AccountRepositoryRecord } from '../../storage/repository.interface'

export type AuthenticatedUserContext = Pick<AuthenticatedUser, 'id'>
export type AccountRecord = AccountRepositoryRecord
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
