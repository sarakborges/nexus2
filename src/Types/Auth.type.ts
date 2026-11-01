export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthSession = {
  user: AuthUser
  authenticatedAt: number
}

export type SignUpCredentials = {
  name: string
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
