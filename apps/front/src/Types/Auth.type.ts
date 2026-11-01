import type { AuthenticatedUser } from '@nexus/common'
export type { AuthSession, SignInCredentials, SignUpCredentials } from '@nexus/common'
export type AuthErrorCode = 'EMAIL_ALREADY_EXISTS' | 'INVALID_CREDENTIALS' | 'STORAGE_UNAVAILABLE' | 'CRYPTO_UNAVAILABLE' | 'NETWORK_ERROR'
export type AuthenticatedUserResponse = { user: AuthenticatedUser; authenticated: true }
