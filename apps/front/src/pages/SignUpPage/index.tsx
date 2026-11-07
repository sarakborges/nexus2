import { Link } from 'react-router'

import { AuthPageLayout } from '@/Components/Organisms/AuthPageLayout/AuthPageLayout.component'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useSignUpPage } from './useSignUpPage'

import '../AuthPage.style.scss'

export function SignUpPage() {
  const { t } = useTranslations()
  const {
    email,
    setEmail,
    password,
    setPassword,
    passwordConfirmation,
    setPasswordConfirmation,
    errorMessage,
    isSubmitting,
    handleSubmit
  } = useSignUpPage()

  return (
    <AuthPageLayout>
      <section className="auth-form-content" aria-labelledby="sign-up-title">
        <header className="auth-form-content__header">
          <h1 className="auth-card__title" id="sign-up-title">
            {t('AUTH_SIGN_UP_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('AUTH_SIGN_UP_DESCRIPTION')}
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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <FormField
            id="password-confirmation"
            label={t('AUTH_CONFIRM_PASSWORD_LABEL')}
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            minLength={8}
            required
          />
          {errorMessage && (
            <p className="auth-card__error" role="alert">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('AUTH_SUBMITTING') : t('AUTH_SIGN_UP_ACTION')}
          </Button>
        </form>
        <p className="auth-card__footer">
          {t('AUTH_HAS_ACCOUNT')}{' '}
          <Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link>
        </p>
      </section>
    </AuthPageLayout>
  )
}
