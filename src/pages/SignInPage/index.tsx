import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { AUTH_ERROR_TRANSLATION_KEYS } from '@/Constants/auth'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { AuthError } from '@/Services/Auth'
import { getUserProfile } from '@/Services/Profile'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'

import '../AuthPage.style.scss'

export function SignInPage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const signIn = useAuthStore((state) => state.signIn)
  const loadProfile = useProfileStore((state) => state.loadProfile)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const user = await signIn({ email, password })
      const profile = getUserProfile(user.id)

      loadProfile(user.id)
      navigate(profile ? ROUTES.home : ROUTES.gettingStarted, { replace: true })
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
      <section className="auth-card" aria-labelledby="sign-in-title">
        <div>
          <h1 className="auth-card__title" id="sign-in-title">
            {t('AUTH_SIGN_IN_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('AUTH_SIGN_IN_DESCRIPTION')}
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
    </main>
  )
}
