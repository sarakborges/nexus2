import { useQueryClient } from '@tanstack/react-query'

import { Navigate, Outlet } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

export function RouteLoadingState() {
  return (
    <main className="account-page">
      <section className="account-card">
        <RequestState isLoading />
      </section>
    </main>
  )
}

export function AuthenticatedRoute() {
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const initializationError = useAuthStore((state) => state.initializationError)

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

  return session ? <Outlet /> : <Navigate to={ROUTES.signIn} replace />
}

export function OnboardingRoute() {
  const session = useAuthStore((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
    <Navigate to={ROUTES.home} replace />
  ) : (
    <Outlet />
  )
}

export function ProfileRequiredRoute() {
  const session = useAuthStore((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
    <Outlet />
  ) : (
    <Navigate to={ROUTES.gettingStarted} replace />
  )
}
