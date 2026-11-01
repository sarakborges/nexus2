import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'

export function GettingStartedPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const signOut = useAuthStore(state => state.signOut)
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      navigate(ROUTES.signIn, { replace: true })
    }
  })

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('GETTING_STARTED_TITLE')}</h1>
            <p className="account-card__description">{t('GETTING_STARTED_DESCRIPTION')}</p>
          </div>
          <Button variation="transparent" disabled={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
            {signOutMutation.isPending ? t('AUTH_SUBMITTING') : t('AUTH_SIGN_OUT')}
          </Button>
        </header>
        {signOutMutation.isError && <p className="auth-card__error" role="alert">{t('REQUEST_FAILED')}</p>}
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
        <Link className="account-card__action" to={ROUTES.createProfile}>{t('GETTING_STARTED_CREATE_PROFILE')}</Link>
      </section>
    </main>
  )
}
