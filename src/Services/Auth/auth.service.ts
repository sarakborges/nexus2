import {
  deleteSession,
  loadSession,
  saveSession
} from '@/Helpers/Systems/Data'
import type { AuthenticatedUser, User } from '@/Models/User.model'
import type {
  AuthErrorCode,
  AuthSession,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'

const USERS_KEY = 'users_v2'
const LEGACY_USERS_KEY = 'auth_accounts_v1'
const SESSION_KEY = 'auth_session_v2'
const LEGACY_SESSION_KEY = 'auth_session_v1'
const PBKDF2_ITERATIONS = 310_000

type LegacyUser = {
  id: string
  email: string
  passwordHash: string
  passwordSalt: string
}

export class AuthError extends Error {
  code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new AuthError('CRYPTO_UNAVAILABLE')
  }

  return globalThis.crypto
}

const encodeBase64 = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))

const decodeBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

const createId = (): string => {
  const bytes = getCrypto().getRandomValues(new Uint8Array(16))

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const derivePasswordHash = async (
  password: string,
  salt: Uint8Array
): Promise<string> => {
  const browserCrypto = getCrypto()
  const passwordKey = await browserCrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await browserCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  )

  return encodeBase64(new Uint8Array(derivedBits))
}

const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = value as Record<string, unknown>
  const password = user.password

  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    !!password &&
    typeof password === 'object' &&
    typeof (password as Record<string, unknown>).hash === 'string' &&
    typeof (password as Record<string, unknown>).salt === 'string'
  )
}

const isLegacyUser = (value: unknown): value is LegacyUser => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = value as Record<string, unknown>

  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.passwordHash === 'string' &&
    typeof user.passwordSalt === 'string'
  )
}

const loadUsers = (): User[] => {
  const storedUsers = loadSession<unknown>(USERS_KEY)

  if (Array.isArray(storedUsers)) {
    return storedUsers.filter(isUser)
  }

  const legacyUsers = loadSession<unknown>(LEGACY_USERS_KEY)

  if (!Array.isArray(legacyUsers)) {
    return []
  }

  const migratedUsers: User[] = legacyUsers.filter(isLegacyUser).map((user) => ({
    id: user.id,
    email: user.email,
    password: {
      hash: user.passwordHash,
      salt: user.passwordSalt
    }
  }))

  if (
    migratedUsers.length > 0 &&
    saveSession({ key: USERS_KEY, value: migratedUsers })
  ) {
    deleteSession(LEGACY_USERS_KEY)
  }

  return migratedUsers
}

const toAuthenticatedUser = (user: User): AuthenticatedUser => ({
  id: user.id,
  email: user.email
})

const parseSession = (value: unknown): AuthSession | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const session = value as Record<string, unknown>
  const user = session.user

  if (
    !user ||
    typeof user !== 'object' ||
    typeof session.authenticatedAt !== 'number'
  ) {
    return null
  }

  const candidate = user as Record<string, unknown>

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    return null
  }

  return {
    user: {
      id: candidate.id,
      email: candidate.email
    },
    authenticatedAt: session.authenticatedAt
  }
}

export const createUser = async ({
  email,
  password
}: SignUpCredentials): Promise<AuthenticatedUser> => {
  const normalizedEmail = normalizeEmail(email)
  const users = loadUsers()

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new AuthError('EMAIL_ALREADY_EXISTS')
  }

  const salt = getCrypto().getRandomValues(new Uint8Array(16))
  const user: User = {
    id: createId(),
    email: normalizedEmail,
    password: {
      salt: encodeBase64(salt),
      hash: await derivePasswordHash(password, salt)
    }
  }

  if (!saveSession({ key: USERS_KEY, value: [...users, user] })) {
    throw new AuthError('STORAGE_UNAVAILABLE')
  }

  return toAuthenticatedUser(user)
}

export const authenticateUser = async ({
  email,
  password
}: SignInCredentials): Promise<AuthenticatedUser> => {
  const user = loadUsers().find(
    (storedUser) => storedUser.email === normalizeEmail(email)
  )

  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS')
  }

  const providedHash = await derivePasswordHash(
    password,
    decodeBase64(user.password.salt)
  )

  if (providedHash !== user.password.hash) {
    throw new AuthError('INVALID_CREDENTIALS')
  }

  return toAuthenticatedUser(user)
}

export const createAuthSession = (
  user: AuthenticatedUser
): AuthSession => {
  const session: AuthSession = {
    user,
    authenticatedAt: Date.now()
  }

  if (!saveSession({ key: SESSION_KEY, value: session })) {
    throw new AuthError('STORAGE_UNAVAILABLE')
  }

  return session
}

export const getCurrentAuthSession = (): AuthSession | null => {
  const currentSession = parseSession(loadSession<unknown>(SESSION_KEY))

  if (currentSession) {
    return currentSession
  }

  const legacySession = parseSession(
    loadSession<unknown>(LEGACY_SESSION_KEY)
  )

  if (
    legacySession &&
    saveSession({ key: SESSION_KEY, value: legacySession })
  ) {
    deleteSession(LEGACY_SESSION_KEY)
  }

  return legacySession
}

export const clearAuthSession = (): void => {
  deleteSession(SESSION_KEY)
  deleteSession(LEGACY_SESSION_KEY)
}
