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
  const profiles = useProfileStore((state) => state.profiles)

  if (!session) {
    return <Outlet />
  }

  return (
    <Navigate
      to={profiles.length > 0 ? ROUTES.home : ROUTES.gettingStarted}
      replace
    />
  )
}

function AuthenticatedRoute() {
  const session = useAuthStore((state) => state.session)

  return session ? <Outlet /> : <Navigate to={ROUTES.signIn} replace />
}

function OnboardingRoute() {
  const profiles = useProfileStore((state) => state.profiles)

  return profiles.length > 0 ? (
    <Navigate to={ROUTES.home} replace />
  ) : (
    <Outlet />
  )
}

function ProfileRequiredRoute() {
  const profiles = useProfileStore((state) => state.profiles)

  return profiles.length > 0 ? (
    <Outlet />
  ) : (
    <Navigate to={ROUTES.gettingStarted} replace />
  )
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
        </Route>

        <Route
          path={ROUTES.createProfile}
          element={<CreateProfilePage />}
        />

        <Route element={<ProfileRequiredRoute />}>
          <Route path={ROUTES.home} element={<HomePage />} />
        </Route>
      </Route>

      <Route
        path={`${ROUTES.profile}/:url`}
        element={<ProfilePage />}
      />

      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}
