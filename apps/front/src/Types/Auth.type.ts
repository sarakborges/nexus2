import type { AuthenticatedUser } from '@/Models/User.model'

export type AuthSession = {
  user: AuthenticatedUser
  authenticatedAt: number
}

export type SignUpCredentials = {
  email: string
  password: string
}

export type SignInCredentials = {
  email: string
  password: string
}

export type AuthErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'STORAGE_UNAVAILABLE'
  | 'CRYPTO_UNAVAILABLE'
