import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { RouteLoadingState } from './RouteLoadingState.component'

export function GuestRoute() {
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const initializationError = useAuthStore(
    (state) => state.initializationError
  )

  if (!isInitialized) return <RouteLoadingState />

  if (initializationError) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() =>
              void queryClient.refetchQueries({
                queryKey: queryKeys.auth.session
              })
            }
          />
        </section>
      </main>
    )
  }

  if (session) {
    return (
      <Navigate
        to={
          session.user.profiles.length > 0
            ? ROUTES.home
            : ROUTES.gettingStarted
        }
        replace
      />
    )
  }

  return <Outlet />
}
