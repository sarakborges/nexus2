import { lazy, Suspense } from 'react'

import { Navigate, Route, Routes, useLocation } from 'react-router'

import { AuthenticatedRoute } from './AuthenticatedRoute.component'
import { GuestRoute } from './GuestRoute.component'
import { OnboardingRoute } from './OnboardingRoute.component'
import { ProfileRequiredRoute } from './ProfileRequiredRoute.component'
import { RouteLoadingState } from './RouteLoadingState.component'

import { ROUTES } from '@/Constants/routes'

const CommunitiesPage = lazy(() =>
  import('@/Pages/CommunitiesPage').then(module => ({ default: module.CommunitiesPage }))
)
const CommunityForumPage = lazy(() =>
  import('@/Pages/CommunityForumPage').then(module => ({ default: module.CommunityForumPage }))
)
const CommunityForumTopicPage = lazy(() =>
  import('@/Pages/CommunityForumTopicPage').then(module => ({ default: module.CommunityForumTopicPage }))
)
const CommunityMembersPage = lazy(() =>
  import('@/Pages/CommunityMembersPage').then(module => ({ default: module.CommunityMembersPage }))
)
const CommunityPage = lazy(() =>
  import('@/Pages/CommunityPage').then(module => ({ default: module.CommunityPage }))
)
const CreateCommunityForumTopicPage = lazy(() =>
  import('@/Pages/CreateCommunityForumTopicPage').then(module => ({ default: module.CreateCommunityForumTopicPage }))
)
const CreateCommunityPage = lazy(() =>
  import('@/Pages/CreateCommunityPage').then(module => ({ default: module.CreateCommunityPage }))
)
const CreateProfilePage = lazy(() =>
  import('@/Pages/CreateProfilePage').then(module => ({ default: module.CreateProfilePage }))
)
const EditCommunityPage = lazy(() =>
  import('@/Pages/EditCommunityPage').then(module => ({ default: module.EditCommunityPage }))
)
const EditProfilePage = lazy(() =>
  import('@/Pages/EditProfilePage').then(module => ({ default: module.EditProfilePage }))
)
const GettingStartedPage = lazy(() =>
  import('@/Pages/GettingStartedPage').then(module => ({ default: module.GettingStartedPage }))
)
const HomePage = lazy(() =>
  import('@/Pages/HomePage').then(module => ({ default: module.HomePage }))
)
const MyProfilesPage = lazy(() =>
  import('@/Pages/MyProfilesPage').then(module => ({ default: module.MyProfilesPage }))
)
const NotFoundPage = lazy(() =>
  import('@/Pages/NotFoundPage').then(module => ({ default: module.NotFoundPage }))
)
const ProfileCommunitiesPage = lazy(() =>
  import('@/Pages/ProfileCommunitiesPage').then(module => ({ default: module.ProfileCommunitiesPage }))
)
const ProfileFriendsPage = lazy(() =>
  import('@/Pages/ProfileFriendsPage').then(module => ({ default: module.ProfileFriendsPage }))
)
const ProfileMessagesPage = lazy(() =>
  import('@/Pages/ProfileMessagesPage').then(module => ({ default: module.ProfileMessagesPage }))
)
const ProfilePage = lazy(() =>
  import('@/Pages/ProfilePage').then(module => ({ default: module.ProfilePage }))
)
const SearchPage = lazy(() =>
  import('@/Pages/SearchPage').then(module => ({ default: module.SearchPage }))
)
const SignInPage = lazy(() =>
  import('@/Pages/SignInPage').then(module => ({ default: module.SignInPage }))
)
const SignUpPage = lazy(() =>
  import('@/Pages/SignUpPage').then(module => ({ default: module.SignUpPage }))
)

export function AppRoutes() {
  const location = useLocation()

  return (
    <Suspense fallback={<RouteLoadingState />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route
            path={ROUTES.landing}
            element={<Navigate to={ROUTES.signIn} replace />}
          />
          <Route path={ROUTES.signUp} element={<SignUpPage />} />
          <Route path={ROUTES.signIn} element={<SignInPage />} />
        </Route>
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
          <Route path={ROUTES.myProfiles} element={<MyProfilesPage />} />
          <Route
            path={ROUTES.createProfile}
            element={<CreateProfilePage key={location.key} />}
          />
          <Route
            path={ROUTES.createCommunity}
            element={<CreateCommunityPage />}
          />
          <Route element={<ProfileRequiredRoute />}>
            <Route path={ROUTES.home} element={<HomePage />} />
          </Route>
        </Route>
        <Route path={ROUTES.search} element={<SearchPage />} />
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
