import { Route, Routes } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import {
  HomePage,
  LandingPage,
  NotFoundPage,
  ProfilePage,
  SignInPage,
  SignUpPage
} from '@/pages'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingPage />} />
      <Route path={ROUTES.signUp} element={<SignUpPage />} />
      <Route path={ROUTES.signIn} element={<SignInPage />} />
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.profile} element={<ProfilePage />} />
      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}
