import { Navigate, Outlet } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthStore } from '@/Stores/Auth.store'

export function OnboardingRoute() {
  const session = useAuthStore((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
    <Navigate to={ROUTES.home} replace />
  ) : (
    <Outlet />
  )
}
