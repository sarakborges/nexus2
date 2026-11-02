import { Link } from 'react-router'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import '../AuthPage.style.scss'

export function LandingPage() {
  const { t } = useTranslations()

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-header__brand" to={ROUTES.landing} aria-label={t('LANDING_TITLE')}>
          {t('LANDING_TITLE')}
        </Link>
        <nav className="landing-header__nav" aria-label={t('LANDING_NAVIGATION')}>
          <Link className="landing-header__sign-in" to={ROUTES.signIn}>
            {t('AUTH_SIGN_IN_LINK')}
          </Link>
          <Link className="landing-header__sign-up" to={ROUTES.signUp}>
            {t('LANDING_SIGNUP_CTA')}
          </Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__content">
          <p className="landing-hero__eyebrow">{t('LANDING_EYEBROW')}</p>
          <h1 className="landing-hero__title" id="landing-title">
            {t('LANDING_TITLE')}
          </h1>
          <p className="landing-hero__description">
            {t('LANDING_DESCRIPTION')}
          </p>
          <div className="landing-hero__actions">
            <Link className="landing-hero__primary-action" to={ROUTES.signUp}>
              {t('LANDING_SIGNUP_CTA')}
            </Link>
            <Link className="landing-hero__secondary-action" to={ROUTES.signIn}>
              {t('AUTH_SIGN_IN_LINK')}
            </Link>
          </div>
        </div>
        <aside className="landing-hero__summary" aria-label={t('LANDING_FEATURES_TITLE')}>
          <p className="landing-hero__summary-label">{t('LANDING_SUMMARY_LABEL')}</p>
          <p className="landing-hero__summary-title">{t('LANDING_SUMMARY_TITLE')}</p>
          <p className="landing-hero__summary-description">{t('LANDING_SUMMARY_DESCRIPTION')}</p>
        </aside>
      </section>

      <section className="landing-features" aria-labelledby="landing-features-title">
        <h2 className="landing-features__title" id="landing-features-title">
          {t('LANDING_FEATURES_TITLE')}
        </h2>
        <div className="landing-features__grid">
          <article className="landing-feature">
            <span className="landing-feature__number" aria-hidden="true">01</span>
            <h3>{t('LANDING_FEATURE_PROFILES_TITLE')}</h3>
            <p>{t('LANDING_FEATURE_PROFILES_DESCRIPTION')}</p>
          </article>
          <article className="landing-feature">
            <span className="landing-feature__number" aria-hidden="true">02</span>
            <h3>{t('LANDING_FEATURE_COMMUNITIES_TITLE')}</h3>
            <p>{t('LANDING_FEATURE_COMMUNITIES_DESCRIPTION')}</p>
          </article>
          <article className="landing-feature">
            <span className="landing-feature__number" aria-hidden="true">03</span>
            <h3>{t('LANDING_FEATURE_CONNECTIONS_TITLE')}</h3>
            <p>{t('LANDING_FEATURE_CONNECTIONS_DESCRIPTION')}</p>
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <p>{t('LANDING_FOOTER_TEXT')}</p>
        <Link to={ROUTES.signUp}>{t('LANDING_SIGNUP_CTA')}</Link>
      </footer>
    </main>
  )
}
