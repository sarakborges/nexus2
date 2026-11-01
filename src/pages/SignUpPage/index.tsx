import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { AUTH_ERROR_TRANSLATION_KEYS } from '@/Constants/auth'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { AuthError } from '@/Services/Auth'
import { useAuthStore } from '@/Stores/Auth.store'

import '../AuthPage.style.scss'

export function SignUpPage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const signUp = useAuthStore((state) => state.signUp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (password !== passwordConfirmation) {
      setErrorMessage(t('AUTH_PASSWORDS_MISMATCH'))
      return
    }

    setIsSubmitting(true)

    try {
      await signUp({ email, password })
      navigate(ROUTES.gettingStarted, { replace: true })
    } catch (error) {
      const translationKey =
        error instanceof AuthError
          ? AUTH_ERROR_TRANSLATION_KEYS[error.code]
          : 'AUTH_ERROR_GENERIC'

      setErrorMessage(t(translationKey))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-up-title">
        <div>
          <h1 className="auth-card__title" id="sign-up-title">
            {t('AUTH_SIGN_UP_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('AUTH_SIGN_UP_DESCRIPTION')}
          </p>
        </div>

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
    </main>
  )
}
