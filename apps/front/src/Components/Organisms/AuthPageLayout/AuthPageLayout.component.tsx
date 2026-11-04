import type { PropsWithChildren } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import './AuthPageLayout.style.scss'

export function AuthPageLayout({ children }: PropsWithChildren) {
  const { t } = useTranslations()

  return (
    <main className="auth-split-page">
      <section className="auth-split-page__story" aria-labelledby="auth-story-title">
        <Link className="auth-split-page__brand" to={ROUTES.landing}>
          {t('LANDING_TITLE')}
        </Link>

        <div className="auth-split-page__intro">
          <p className="auth-split-page__eyebrow">{t('LANDING_EYEBROW')}</p>
          <h1 id="auth-story-title">{t('LANDING_TITLE')}</h1>
          <p>{t('LANDING_DESCRIPTION')}</p>
        </div>

        <div className="auth-split-page__features">
          <article className="auth-split-page__feature">
            <span aria-hidden="true">01</span>
            <div>
              <h2>{t('LANDING_FEATURE_PROFILES_TITLE')}</h2>
              <p>{t('LANDING_FEATURE_PROFILES_DESCRIPTION')}</p>
            </div>
          </article>
          <article className="auth-split-page__feature">
            <span aria-hidden="true">02</span>
            <div>
              <h2>{t('LANDING_FEATURE_COMMUNITIES_TITLE')}</h2>
              <p>{t('LANDING_FEATURE_COMMUNITIES_DESCRIPTION')}</p>
            </div>
          </article>
          <article className="auth-split-page__feature">
            <span aria-hidden="true">03</span>
            <div>
              <h2>{t('LANDING_FEATURE_CONNECTIONS_TITLE')}</h2>
              <p>{t('LANDING_FEATURE_CONNECTIONS_DESCRIPTION')}</p>
            </div>
          </article>
        </div>

        <p className="auth-split-page__footer">{t('LANDING_FOOTER_TEXT')}</p>
      </section>

      <section className="auth-split-page__form-panel" aria-label={t('AUTH_FORM_REGION')}>
        <Link className="auth-page__back" to={ROUTES.landing}>{t('AUTH_BACK_TO_LANDING')}</Link>
        {children}
      </section>
    </main>
  )
}
