import { Navigate, Outlet, Route, Routes } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'
import {
  CreateProfilePage,
  GettingStartedPage,
  HomePage,
  LandingPage,
  NotFoundPage,
  ProfilePage,
  SignInPage,
  SignUpPage
} from '@/pages'

function GuestOnlyRoute() {
  const session = useAuthStore((state) => state.session)
  const profile = useProfileStore((state) => state.profile)

  if (!session) {
    return <Outlet />
  }

  return (
    <Navigate
      to={profile ? ROUTES.home : ROUTES.gettingStarted}
      replace
    />
  )
}

function AuthenticatedRoute() {
  const session = useAuthStore((state) => state.session)

  return session ? <Outlet /> : <Navigate to={ROUTES.signIn} replace />
}

function OnboardingRoute() {
  const profile = useProfileStore((state) => state.profile)

  return profile ? <Navigate to={ROUTES.home} replace /> : <Outlet />
}

function ProfileRequiredRoute() {
  const profile = useProfileStore((state) => state.profile)

  return profile ? <Outlet /> : <Navigate to={ROUTES.gettingStarted} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingPage />} />

      <Route element={<GuestOnlyRoute />}>
        <Route path={ROUTES.signUp} element={<SignUpPage />} />
        <Route path={ROUTES.signIn} element={<SignInPage />} />
      </Route>

      <Route element={<AuthenticatedRoute />}>
        <Route element={<OnboardingRoute />}>
          <Route
            path={ROUTES.gettingStarted}
            element={<GettingStartedPage />}
          />
          <Route
            path={ROUTES.createProfile}
            element={<CreateProfilePage />}
          />
        </Route>

        <Route element={<ProfileRequiredRoute />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}
