import { useAuthSession } from './useAuthSession.hook'
import type { UseAuthSessionStateSelector } from './useAuthSessionState.types'

export function useAuthSessionState<T>(
  selector: UseAuthSessionStateSelector<T>
): T {
  const authQuery = useAuthSession()

  return selector({
    session: authQuery.data ?? null,
    isInitialized: authQuery.isFetched,
    initializationError: authQuery.isError && !authQuery.data
  })
}
