import { Navigate, Outlet, Route, Routes } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthStore } from '@/Stores/Auth.store'
import {
  HomePage,
  LandingPage,
  NotFoundPage,
  ProfilePage,
  SignInPage,
  SignUpPage
} from '@/pages'

function GuestOnlyRoute() {
  const session = useAuthStore((state) => state.session)

  return session ? <Navigate to={ROUTES.home} replace /> : <Outlet />
}

function ProtectedRoute() {
  const session = useAuthStore((state) => state.session)

  return session ? <Outlet /> : <Navigate to={ROUTES.signIn} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingPage />} />

      <Route element={<GuestOnlyRoute />}>
        <Route path={ROUTES.signUp} element={<SignUpPage />} />
        <Route path={ROUTES.signIn} element={<SignInPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
      </Route>

      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}
