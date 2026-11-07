import { Button, ButtonLink } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useGettingStartedPage } from './useGettingStartedPage'

import { ROUTES } from '@/Constants/routes'

import '../AuthenticatedPage.style.scss'

export function GettingStartedPage() {
  const { t } = useTranslations()
  const { isSigningOut, hasSignOutError, signOut } = useGettingStartedPage()

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">
              {t('GETTING_STARTED_TITLE')}
            </h1>
            <p className="account-card__description">
              {t('GETTING_STARTED_DESCRIPTION')}
            </p>
          </div>
          <Button disabled={isSigningOut} onClick={signOut}>
            {isSigningOut ? t('AUTH_SUBMITTING') : t('AUTH_SIGN_OUT')}
          </Button>
        </header>
        {hasSignOutError && (
          <p className="auth-card__error" role="alert">
            {t('REQUEST_FAILED')}
          </p>
        )}
        <div className="account-card__onboarding">
          <h2>{t('GETTING_STARTED_PROFILE_TITLE')}</h2>
          <p>{t('GETTING_STARTED_PROFILE_DESCRIPTION')}</p>
          <ul>
            <li>{t('GETTING_STARTED_PROFILE_NAME')}</li>
            <li>{t('GETTING_STARTED_PROFILE_URL')}</li>
            <li>{t('GETTING_STARTED_PROFILE_PICTURE')}</li>
            <li>{t('GETTING_STARTED_PROFILE_ABOUT')}</li>
          </ul>
        </div>
        <ButtonLink
          className="account-card__action"
          variation="primary"
          to={ROUTES.createProfile}
        >
          {t('GETTING_STARTED_CREATE_PROFILE')}
        </ButtonLink>
      </section>
    </main>
  )
}
