import { useQueryClient } from '@tanstack/react-query'

import { Navigate, Outlet, Route, Routes } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import {
  CommunitiesPage,
  CommunityForumPage,
  CommunityForumTopicPage,
  CommunityMembersPage,
  CommunityPage,
  CreateCommunityForumTopicPage,
  CreateCommunityPage,
  CreateProfilePage,
  EditCommunityPage,
  EditProfilePage,
  GettingStartedPage,
  HomePage,
  NotFoundPage,
  ProfileCommunitiesPage,
  ProfileFriendsPage,
  ProfileMessagesPage,
  ProfilePage,
  SignInPage,
  SignUpPage
} from '@/pages'

function AuthenticatedRoute() {
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const initializationError = useAuthStore((state) => state.initializationError)
  if (!isInitialized)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
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
      <Route
        path={ROUTES.landing}
        element={<Navigate to={ROUTES.signIn} replace />}
      />
      <Route path={ROUTES.signUp} element={<SignUpPage />} />
      <Route path={ROUTES.signIn} element={<SignInPage />} />
      <Route element={<AuthenticatedRoute />}>
        <Route
          path={`${ROUTES.profile}/:url/edit`}
          element={<EditProfilePage />}
        />
        <Route
          path={`${ROUTES.community}/:url/edit`}
          element={<EditCommunityPage />}
        />
        <Route element={<OnboardingRoute />}>
          <Route
            path={ROUTES.gettingStarted}
            element={<GettingStartedPage />}
          />
        </Route>
        <Route path={ROUTES.createProfile} element={<CreateProfilePage />} />
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
        path={`${ROUTES.community}/:url/forum/new`}
        element={<CreateCommunityForumTopicPage />}
      />
      <Route
        path={`${ROUTES.community}/:url/forum/:topicId`}
        element={<CommunityForumTopicPage />}
      />
      <Route
        path={`${ROUTES.community}/:url/forum`}
        element={<CommunityForumPage />}
      />
      <Route
        path={`${ROUTES.community}/:url/members`}
        element={<CommunityMembersPage />}
      />
      <Route path={`${ROUTES.community}/:url`} element={<CommunityPage />} />
      <Route
        path={`${ROUTES.profile}/:url/friends`}
        element={<ProfileFriendsPage />}
      />
      <Route
        path={`${ROUTES.profile}/:url/communities`}
        element={<ProfileCommunitiesPage />}
      />
      <Route
        path={`${ROUTES.profile}/:url/messages`}
        element={<ProfileMessagesPage />}
      />
      <Route path={`${ROUTES.profile}/:url`} element={<ProfilePage />} />
      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}
