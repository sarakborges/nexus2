import { lazy, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Navigate, Outlet, Route, Routes } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

const CommunitiesPage = lazy(() =>
  import('@/pages/CommunitiesPage').then(module => ({ default: module.CommunitiesPage }))
)
const CommunityForumPage = lazy(() =>
  import('@/pages/CommunityForumPage').then(module => ({ default: module.CommunityForumPage }))
)
const CommunityForumTopicPage = lazy(() =>
  import('@/pages/CommunityForumTopicPage').then(module => ({ default: module.CommunityForumTopicPage }))
)
const CommunityMembersPage = lazy(() =>
  import('@/pages/CommunityMembersPage').then(module => ({ default: module.CommunityMembersPage }))
)
const CommunityPage = lazy(() =>
  import('@/pages/CommunityPage').then(module => ({ default: module.CommunityPage }))
)
const CreateCommunityForumTopicPage = lazy(() =>
  import('@/pages/CreateCommunityForumTopicPage').then(module => ({ default: module.CreateCommunityForumTopicPage }))
)
const CreateCommunityPage = lazy(() =>
  import('@/pages/CreateCommunityPage').then(module => ({ default: module.CreateCommunityPage }))
)
const CreateProfilePage = lazy(() =>
  import('@/pages/CreateProfilePage').then(module => ({ default: module.CreateProfilePage }))
)
const EditCommunityPage = lazy(() =>
  import('@/pages/EditCommunityPage').then(module => ({ default: module.EditCommunityPage }))
)
const EditProfilePage = lazy(() =>
  import('@/pages/EditProfilePage').then(module => ({ default: module.EditProfilePage }))
)
const GettingStartedPage = lazy(() =>
  import('@/pages/GettingStartedPage').then(module => ({ default: module.GettingStartedPage }))
)
const HomePage = lazy(() =>
  import('@/pages/HomePage').then(module => ({ default: module.HomePage }))
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then(module => ({ default: module.NotFoundPage }))
)
const ProfileCommunitiesPage = lazy(() =>
  import('@/pages/ProfileCommunitiesPage').then(module => ({ default: module.ProfileCommunitiesPage }))
)
const ProfileFriendsPage = lazy(() =>
  import('@/pages/ProfileFriendsPage').then(module => ({ default: module.ProfileFriendsPage }))
)
const ProfileMessagesPage = lazy(() =>
  import('@/pages/ProfileMessagesPage').then(module => ({ default: module.ProfileMessagesPage }))
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then(module => ({ default: module.ProfilePage }))
)
const SignInPage = lazy(() =>
  import('@/pages/SignInPage').then(module => ({ default: module.SignInPage }))
)
const SignUpPage = lazy(() =>
  import('@/pages/SignUpPage').then(module => ({ default: module.SignUpPage }))
)

function RouteLoadingState() {
  return (
    <main className="account-page">
      <section className="account-card">
        <RequestState isLoading />
      </section>
    </main>
  )
}

function AuthenticatedRoute() {
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
    <Suspense fallback={<RouteLoadingState />}>
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
    </Suspense>
  )
}
