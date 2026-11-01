import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'

import '../AuthenticatedPage.style.scss'

export function ProfilePage() {
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)

  return (
    <main className="account-page">
      <section className="account-card">
        <div>
          <h1 className="account-card__title">{t('PROFILE_TITLE')}</h1>
          <p className="account-card__description">
            {t('PROFILE_DESCRIPTION')}
          </p>
        </div>

        <dl className="account-card__details">
          <div>
            <dt>{t('AUTH_NAME_LABEL')}</dt>
            <dd>{session?.user.name}</dd>
          </div>
          <div>
            <dt>{t('AUTH_EMAIL_LABEL')}</dt>
            <dd>{session?.user.email}</dd>
          </div>
        </dl>

        <Link className="account-card__link" to={ROUTES.home}>
          {t('PROFILE_BACK_HOME')}
        </Link>
      </section>
    </main>
  )
}
