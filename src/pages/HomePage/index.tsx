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
  const setCurrentProfile = useAuthStore((state) => state.setCurrentProfile)
  const profiles = useProfileStore((state) => state.profiles)
  const signOut = useAuthStore((state) => state.signOut)

  const handleSignOut = () => {
    signOut()
    navigate(ROUTES.signIn, { replace: true })
  }

  const handleSelectProfile = (profileId: string) => {
    setCurrentProfile(profileId)
  }

  const currentProfileId = session?.user.currentProfile

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">
              {t('HOME_WELCOME', {
                name:
                  profiles.find((profile) => profile.id === currentProfileId)
                    ?.name ?? ''
              })}
            </p>
          </div>

          <Button variation="transparent" onClick={handleSignOut}>
            {t('AUTH_SIGN_OUT')}
          </Button>
        </header>

        <p className="account-card__description">{session?.user.email}</p>

        <div className="account-card__profile-list">
          <h2>{t('HOME_PROFILES_TITLE')}</h2>
          {profiles.map((profile) => {
            const isCurrentProfile = profile.id === currentProfileId

            return (
              <div className="account-card__profile-entry" key={profile.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.profile}/${profile.url}`}
                >
                  {profile.name} · /profile/{profile.url}
                </Link>

                {isCurrentProfile ? (
                  <span className="account-card__current-profile">
                    {t('HOME_CURRENT_PROFILE')}
                  </span>
                ) : (
                  <Button
                    variation="secondary"
                    onClick={() => handleSelectProfile(profile.id)}
                  >
                    {t('HOME_USE_PROFILE')}
                  </Button>
                )}
              </div>
            )
          })}
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
