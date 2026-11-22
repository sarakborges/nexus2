import { Navigate, Outlet } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthSessionState } from '@/Hooks/Auth'

export function OnboardingRoute() {
  const session = useAuthSessionState((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
    <Navigate to={ROUTES.home} replace />
  ) : (
    <Outlet />
  )
}
