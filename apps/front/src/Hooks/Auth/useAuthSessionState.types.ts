import type { AuthSession } from '@nexus/common'

export type AuthSessionState = {
  session: AuthSession | null
  isInitialized: boolean
  initializationError: boolean
}

export type UseAuthSessionStateSelector<T> = (
  state: AuthSessionState
) => T
