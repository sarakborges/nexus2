import type { PropsWithChildren } from 'react'
import { useTranslations } from '@/Hooks/Language'

import './AuthPageLayout.style.scss'

export function AuthPageLayout({ children }: PropsWithChildren) {
  const { t } = useTranslations()

  return (
    <main className="auth-split-page">
      <section className="auth-split-page__story" aria-labelledby="auth-story-title">
        <span className="auth-split-page__brand">NEXUS</span>

        <div className="auth-split-page__intro">
          <p className="auth-split-page__eyebrow">{t('AUTH_STORY_EYEBROW')}</p>
          <h1 id="auth-story-title">{t('AUTH_STORY_TITLE')}</h1>
          <p>{t('AUTH_STORY_DESCRIPTION')}</p>
        </div>

        <div className="auth-split-page__features">
          <article className="auth-split-page__feature">
            <span aria-hidden="true">01</span>
            <div>
              <h2>{t('AUTH_STORY_PROFILES_TITLE')}</h2>
              <p>{t('AUTH_STORY_PROFILES_DESCRIPTION')}</p>
            </div>
          </article>
          <article className="auth-split-page__feature">
            <span aria-hidden="true">02</span>
            <div>
              <h2>{t('AUTH_STORY_COMMUNITIES_TITLE')}</h2>
              <p>{t('AUTH_STORY_COMMUNITIES_DESCRIPTION')}</p>
            </div>
          </article>
          <article className="auth-split-page__feature">
            <span aria-hidden="true">03</span>
            <div>
              <h2>{t('AUTH_STORY_CONNECTIONS_TITLE')}</h2>
              <p>{t('AUTH_STORY_CONNECTIONS_DESCRIPTION')}</p>
            </div>
          </article>
        </div>

        <p className="auth-split-page__footer">{t('AUTH_STORY_FOOTER')}</p>
      </section>

      <section className="auth-split-page__form-panel" aria-label={t('AUTH_FORM_REGION')}>
        {children}
      </section>
    </main>
  )
}
