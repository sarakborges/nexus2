import { Navigate, Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'

import '../AuthPage.style.scss'

export function LandingPage() {
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const profile = useProfileStore((state) => state.profile)

  if (session) {
    return (
      <Navigate
        to={profile ? ROUTES.home : ROUTES.gettingStarted}
        replace
      />
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="landing-title">
        <div>
          <h1 className="auth-card__title" id="landing-title">
            {t('LANDING_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('LANDING_DESCRIPTION')}
          </p>
        </div>

        <div className="landing-card__actions">
          <Link
            className="landing-card__link landing-card__link--primary"
            to={ROUTES.signUp}
          >
            {t('AUTH_SIGN_UP_LINK')}
          </Link>
          <Link
            className="landing-card__link landing-card__link--secondary"
            to={ROUTES.signIn}
          >
            {t('AUTH_SIGN_IN_LINK')}
          </Link>
        </div>
      </section>
    </main>
  )
}
