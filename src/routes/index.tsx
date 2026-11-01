import { Navigate, Outlet, Route, Routes } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthStore } from '@/Stores/Auth.store'
import {
  CommunitiesPage,
  CommunityFriendsPage,
  CommunityPage,
  CreateCommunityPage,
  CreateProfilePage,
  GettingStartedPage,
  HomePage,
  LandingPage,
  NotFoundPage,
  ProfileFriendsPage,
  ProfilePage,
  SignInPage,
  SignUpPage
} from '@/pages'

function GuestOnlyRoute() {
  const session = useAuthStore((state) => state.session)

  if (!session) {
    return <Outlet />
  }

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

function AuthenticatedRoute() {
  const session = useAuthStore((state) => state.session)

  return session ? <Outlet /> : <Navigate to={ROUTES.signIn} replace />
}

function OnboardingRoute() {
  const session = useAuthStore((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
    <Navigate to={ROUTES.home} replace />
  ) : (
    <Outlet />
  )
}

function ProfileRequiredRoute() {
  const session = useAuthStore((state) => state.session)

  return (session?.user.profiles.length ?? 0) > 0 ? (
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
        <Route
          path={ROUTES.createCommunity}
          element={<CreateCommunityPage />}
        />

        <Route element={<ProfileRequiredRoute />}>
          <Route path={ROUTES.home} element={<HomePage />} />
        </Route>
      </Route>

      <Route path={ROUTES.communities} element={<CommunitiesPage />} />
      <Route
        path={`${ROUTES.community}/:url/friends`}
        element={<CommunityFriendsPage />}
      />
      <Route
        path={`${ROUTES.community}/:url`}
        element={<CommunityPage />}
      />

      <Route
        path={`${ROUTES.profile}/:url/friends`}
        element={<ProfileFriendsPage />}
      />
      <Route
        path={`${ROUTES.profile}/:url`}
        element={<ProfilePage />}
      />

      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}
