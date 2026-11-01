import {
  deleteSession,
  loadData,
  loadSession,
  saveData,
  saveSession
} from '@/Helpers/Systems/Data'
import type { AuthenticatedUser, User } from '@/Models/User.model'
import type {
  AuthErrorCode,
  AuthSession,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'

const USERS_KEY = 'users'
const LEGACY_USERS_KEYS = ['users_v2', 'auth_accounts_v1'] as const
const SESSION_KEY = 'auth_session_v2'
const LEGACY_SESSION_KEY = 'auth_session_v1'
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

const migrateUser = (value: unknown): User | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const user = value as Record<string, unknown>
  const password = user.password

  if (typeof user.id !== 'string' || typeof user.email !== 'string') {
    return null
  }

  let passwordHash: string | null = null
  let passwordSalt: string | null = null

  if (
    password &&
    typeof password === 'object' &&
    typeof (password as Record<string, unknown>).hash === 'string' &&
    typeof (password as Record<string, unknown>).salt === 'string'
  ) {
    passwordHash = (password as Record<string, string>).hash
    passwordSalt = (password as Record<string, string>).salt
  } else if (
    typeof user.passwordHash === 'string' &&
    typeof user.passwordSalt === 'string'
  ) {
    passwordHash = user.passwordHash
    passwordSalt = user.passwordSalt
  }

  if (!passwordHash || !passwordSalt) {
    return null
  }

  const profiles = Array.isArray(user.profiles)
    ? user.profiles.filter(
        (profileId): profileId is string => typeof profileId === 'string'
      )
    : []
  const requestedCurrentProfile =
    typeof user.currentProfile === 'string' ? user.currentProfile : null

  return {
    id: user.id,
    email: normalizeEmail(user.email),
    password: {
      hash: passwordHash,
      salt: passwordSalt
    },
    profiles,
    currentProfile:
      requestedCurrentProfile && profiles.includes(requestedCurrentProfile)
        ? requestedCurrentProfile
        : profiles[0] ?? null
  }
}

const loadUsers = (): User[] => {
  const storedUsers = loadData<unknown>(USERS_KEY)

  if (Array.isArray(storedUsers)) {
    const users = storedUsers
      .map(migrateUser)
      .filter((user): user is User => user !== null)

    const requiresMigration =
      users.length !== storedUsers.length ||
      storedUsers.some((value) => {
        if (!value || typeof value !== 'object') {
          return true
        }

        const user = value as Record<string, unknown>

        return (
          !Array.isArray(user.profiles) ||
          !Object.prototype.hasOwnProperty.call(user, 'currentProfile')
        )
      })

    if (requiresMigration) {
      saveData({ key: USERS_KEY, value: users })
    }

    return users
  }

  for (const legacyKey of LEGACY_USERS_KEYS) {
    const legacyUsers = loadSession<unknown>(legacyKey)

    if (!Array.isArray(legacyUsers)) {
      continue
    }

    const migratedUsers = legacyUsers
      .map(migrateUser)
      .filter((user): user is User => user !== null)

    if (saveData({ key: USERS_KEY, value: migratedUsers })) {
      deleteSession(legacyKey)
      return migratedUsers
    }
  }

  return []
}

const toAuthenticatedUser = (user: User): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  profiles: [...user.profiles],
  currentProfile: user.currentProfile
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

  const profiles = Array.isArray(candidate.profiles)
    ? candidate.profiles.filter(
        (profileId): profileId is string => typeof profileId === 'string'
      )
    : []
  const requestedCurrentProfile =
    typeof candidate.currentProfile === 'string'
      ? candidate.currentProfile
      : null

  return {
    user: {
      id: candidate.id,
      email: candidate.email,
      profiles,
      currentProfile:
        requestedCurrentProfile && profiles.includes(requestedCurrentProfile)
          ? requestedCurrentProfile
          : profiles[0] ?? null
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
    },
    profiles: [],
    currentProfile: null
  }

  if (!saveData({ key: USERS_KEY, value: [...users, user] })) {
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
  let session = parseSession(loadSession<unknown>(SESSION_KEY))

  if (!session) {
    session = parseSession(loadSession<unknown>(LEGACY_SESSION_KEY))

    if (
      session &&
      saveSession({ key: SESSION_KEY, value: session })
    ) {
      deleteSession(LEGACY_SESSION_KEY)
    }
  }

  if (!session) {
    return null
  }

  const user = loadUsers().find((item) => item.id === session?.user.id)

  if (!user) {
    return session
  }

  const refreshedSession: AuthSession = {
    ...session,
    user: toAuthenticatedUser(user)
  }

  if (
    refreshedSession.user.currentProfile !== session.user.currentProfile ||
    refreshedSession.user.profiles.length !== session.user.profiles.length
  ) {
    saveSession({ key: SESSION_KEY, value: refreshedSession })
  }

  return refreshedSession
}

export const clearAuthSession = (): void => {
  deleteSession(SESSION_KEY)
  deleteSession(LEGACY_SESSION_KEY)
}

const persistUserUpdate = (
  previousUsers: User[],
  updatedUsers: User[],
  updatedUser: User
): boolean => {
  if (!saveData({ key: USERS_KEY, value: updatedUsers })) {
    return false
  }

  const session = parseSession(loadSession<unknown>(SESSION_KEY))

  if (session?.user.id === updatedUser.id) {
    if (
      !saveSession({
        key: SESSION_KEY,
        value: {
          ...session,
          user: toAuthenticatedUser(updatedUser)
        }
      })
    ) {
      saveData({ key: USERS_KEY, value: previousUsers })
      return false
    }
  }

  return true
}

export const addProfileToUser = (
  userId: string,
  profileId: string
): boolean => {
  const users = loadUsers()
  const user = users.find((item) => item.id === userId)

  if (!user) {
    return false
  }

  const updatedUser: User = {
    ...user,
    profiles: user.profiles.includes(profileId)
      ? user.profiles
      : [...user.profiles, profileId],
    currentProfile: user.currentProfile ?? profileId
  }
  const updatedUsers = users.map((item) =>
    item.id === userId ? updatedUser : item
  )

  return persistUserUpdate(users, updatedUsers, updatedUser)
}

export const setUserCurrentProfile = (
  userId: string,
  profileId: string
): AuthenticatedUser | null => {
  const users = loadUsers()
  const user = users.find((item) => item.id === userId)

  if (!user || !user.profiles.includes(profileId)) {
    return null
  }

  const updatedUser: User = {
    ...user,
    currentProfile: profileId
  }
  const updatedUsers = users.map((item) =>
    item.id === userId ? updatedUser : item
  )

  if (!persistUserUpdate(users, updatedUsers, updatedUser)) {
    return null
  }

  return toAuthenticatedUser(updatedUser)
}

export const getUserById = (userId: string): AuthenticatedUser | null => {
  const user = loadUsers().find((storedUser) => storedUser.id === userId)

  return user ? toAuthenticatedUser(user) : null
}
