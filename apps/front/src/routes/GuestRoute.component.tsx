import { Navigate, Outlet } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useAuthSession } from '@/Hooks/Auth'
import { RouteLoadingState } from './RouteLoadingState.component'

export function GuestRoute() {
  const authQuery = useAuthSession()
  const session = authQuery.data ?? null
  const isInitialized = authQuery.isFetched
  const initializationError = authQuery.isError && !authQuery.data

  if (!isInitialized) return <RouteLoadingState />

  if (initializationError) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void authQuery.refetch()}
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
