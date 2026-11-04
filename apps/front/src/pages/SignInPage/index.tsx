import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'

import { AUTH_ERROR_TRANSLATION_KEYS } from '@/Constants/auth'
import { ROUTES } from '@/Constants/routes'
import { AuthPageLayout } from '@/Components/Organisms/AuthPageLayout/AuthPageLayout.component'
import { Button, FormField } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { AuthError } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

import '../AuthPage.style.scss'

export function SignInPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const signIn = useAuthStore(state => state.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: user => queryClient.setQueryData(queryKeys.auth.session, { user, authenticatedAt: Date.now() })
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    try {
      const user = await signInMutation.mutateAsync({ email, password })
      navigate(user.profiles.length > 0 ? ROUTES.home : ROUTES.gettingStarted, { replace: true })
    } catch (error) {
      const translationKey = error instanceof AuthError ? AUTH_ERROR_TRANSLATION_KEYS[error.code] : 'AUTH_ERROR_GENERIC'
      setErrorMessage(t(translationKey))
    }
  }

  return (
    <AuthPageLayout>
      <section className="auth-card" aria-labelledby="sign-in-title">
        <div>
          <h1 className="auth-card__title" id="sign-in-title">{t('AUTH_SIGN_IN_TITLE')}</h1>
          <p className="auth-card__description">{t('AUTH_SIGN_IN_DESCRIPTION')}</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField id="email" label={t('AUTH_EMAIL_LABEL')} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
          <FormField id="password" label={t('AUTH_PASSWORD_LABEL')} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          {errorMessage && <p className="auth-card__error" role="alert">{errorMessage}</p>}
          <Button type="submit" disabled={signInMutation.isPending}>{signInMutation.isPending ? t('AUTH_SUBMITTING') : t('AUTH_SIGN_IN_ACTION')}</Button>
        </form>
        <p className="auth-card__footer">{t('AUTH_NO_ACCOUNT')}{' '}<Link to={ROUTES.signUp}>{t('AUTH_SIGN_UP_LINK')}</Link></p>
      </section>
      <
    </AuthPageLayout>
  )
}
