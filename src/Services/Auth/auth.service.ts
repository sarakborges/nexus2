import {
  deleteSession,
  loadSession,
  saveSession
} from '@/Helpers/Systems/Data'
import type {
  AuthErrorCode,
  AuthSession,
  AuthUser,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'

type StoredAccount = AuthUser & {
  passwordHash: string
  passwordSalt: string
}

const ACCOUNTS_KEY = 'auth_accounts_v1'
const SESSION_KEY = 'auth_session_v1'
const PBKDF2_ITERATIONS = 310_000

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

const isStoredAccount = (value: unknown): value is StoredAccount => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const account = value as Record<string, unknown>

  return (
    typeof account.id === 'string' &&
    typeof account.name === 'string' &&
    typeof account.email === 'string' &&
    typeof account.passwordHash === 'string' &&
    typeof account.passwordSalt === 'string'
  )
}

const loadAccounts = (): StoredAccount[] => {
  const storedAccounts = loadSession<unknown>(ACCOUNTS_KEY)

  return Array.isArray(storedAccounts)
    ? storedAccounts.filter(isStoredAccount)
    : []
}

const toAuthUser = (account: StoredAccount): AuthUser => ({
  id: account.id,
  name: account.name,
  email: account.email
})

export const createAuthSession = (user: AuthUser): AuthSession => {
  const session: AuthSession = {
    user,
    authenticatedAt: Date.now()
  }

  if (!saveSession({ key: SESSION_KEY, value: session })) {
    throw new AuthError('STORAGE_UNAVAILABLE')
  }

  return session
}

export const createAccount = async ({
  name,
  email,
  password
}: SignUpCredentials): Promise<AuthUser> => {
  const accounts = loadAccounts()
  const normalizedEmail = normalizeEmail(email)

  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new AuthError('EMAIL_ALREADY_EXISTS')
  }

  const salt = getCrypto().getRandomValues(new Uint8Array(16))
  const account: StoredAccount = {
    id: createId(),
    name: name.trim(),
    email: normalizedEmail,
    passwordSalt: encodeBase64(salt),
    passwordHash: await derivePasswordHash(password, salt)
  }

  if (
    !saveSession({
      key: ACCOUNTS_KEY,
      value: [...accounts, account]
    })
  ) {
    throw new AuthError('STORAGE_UNAVAILABLE')
  }

  return toAuthUser(account)
}

export const authenticate = async ({
  email,
  password
}: SignInCredentials): Promise<AuthUser> => {
  const account = loadAccounts().find(
    (storedAccount) => storedAccount.email === normalizeEmail(email)
  )

  if (!account) {
    throw new AuthError('INVALID_CREDENTIALS')
  }

  let providedHash: string

  try {
    providedHash = await derivePasswordHash(
      password,
      decodeBase64(account.passwordSalt)
    )
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }

    throw new AuthError('INVALID_CREDENTIALS')
  }

  if (providedHash !== account.passwordHash) {
    throw new AuthError('INVALID_CREDENTIALS')
  }

  return toAuthUser(account)
}

export const getCurrentAuthSession = (): AuthSession | null => {
  const storedSession = loadSession<unknown>(SESSION_KEY)

  if (!storedSession || typeof storedSession !== 'object') {
    return null
  }

  const session = storedSession as Record<string, unknown>
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
    typeof candidate.name !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    return null
  }

  return {
    user: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email
    },
    authenticatedAt: session.authenticatedAt
  }
}

export const clearAuthSession = (): void => {
  deleteSession(SESSION_KEY)
}
