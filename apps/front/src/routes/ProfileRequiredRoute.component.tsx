import { Navigate, Outlet } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthSessionState } from '@/Hooks/Auth'

export function ProfileRequiredRoute() {
  const session = useAuthSessionState((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
    <Outlet />
  ) : (
    <Navigate to={ROUTES.gettingStarted} replace />
  )
}
