import { Link } from 'react-router'

import { AuthPageLayout } from '@/Components/Organisms/AuthPageLayout/AuthPageLayout.component'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useSignInPage } from './useSignInPage'

import '../AuthPage.style.scss'

export function SignInPage() {
  const { t } = useTranslations()
  const {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isSubmitting,
    handleSubmit
  } = useSignInPage()

  return (
    <AuthPageLayout>
      <section className="auth-form-content" aria-labelledby="sign-in-title">
        <header className="auth-form-content__header">
          <h1 className="auth-card__title" id="sign-in-title">
            {t('AUTH_SIGN_IN_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('AUTH_SIGN_IN_DESCRIPTION')}
          </p>
        </header>
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            id="email"
            label={t('AUTH_EMAIL_LABEL')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <FormField
            id="password"
            label={t('AUTH_PASSWORD_LABEL')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {errorMessage && (
            <p className="auth-card__error" role="alert">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('AUTH_SUBMITTING') : t('AUTH_SIGN_IN_ACTION')}
          </Button>
        </form>
        <p className="auth-card__footer">
          {t('AUTH_NO_ACCOUNT')}{' '}
          <Link to={ROUTES.signUp}>{t('AUTH_SIGN_UP_LINK')}</Link>
        </p>
      </section>
    </AuthPageLayout>
  )
}
