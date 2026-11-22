import { Navigate, Outlet } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthSessionState } from '@/Hooks/Auth'

export function ProfileRequiredRoute() {
  const session = useAuthSessionState((state) => state.session)

  return session?.currentProfile?.id ? (
    <Outlet />
  ) : (
    <Navigate to={ROUTES.myProfiles} replace />
  )
}
