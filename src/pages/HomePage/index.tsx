import { Link, useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'

import '../AuthenticatedPage.style.scss'

export function HomePage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const profiles = useProfileStore((state) => state.profiles)
  const signOut = useAuthStore((state) => state.signOut)

  const handleSignOut = () => {
    signOut()
    navigate(ROUTES.signIn, { replace: true })
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">
              {t('HOME_WELCOME', { name: profiles[0]?.name ?? '' })}
            </p>
          </div>

          <Button variation="transparent" onClick={handleSignOut}>
            {t('AUTH_SIGN_OUT')}
          </Button>
        </header>

        <p className="account-card__description">{session?.user.email}</p>

        <div className="account-card__profile-list">
          <h2>{t('HOME_PROFILES_TITLE')}</h2>
          {profiles.map((profile) => (
            <Link
              className="account-card__link"
              key={profile.id}
              to={`${ROUTES.profile}/${profile.url}`}
            >
              {profile.name} · /profile/{profile.url}
            </Link>
          ))}
        </div>

        <Link
          className="account-card__action"
          to={ROUTES.createProfile}
        >
          {t('HOME_CREATE_PROFILE')}
        </Link>
      </section>
    </main>
  )
}
