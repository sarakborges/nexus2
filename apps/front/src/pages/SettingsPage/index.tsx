import { useNavigate, Link } from 'react-router'
import { LanguageSelector } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { SUPPORTED_THEME_PREFERENCES, THEME_PREFERENCE_NAME_KEYS } from '@/Constants/themes'
import { Button } from '@/DesignSystem'
import { useThemePreference } from '@/Hooks/Theme'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'

export function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const { themePreference, setTheme } = useThemePreference()
  const session = useAuthStore(state => state.session)
  const signOut = useAuthStore(state => state.signOut)

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.signIn, { replace: true })
  }

  return (
    <main className="account-page">
      <section className="account-card settings-page" aria-labelledby="settings-title">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title" id="settings-title">{t('SETTINGS_TITLE')}</h1>
            <p className="account-card__description">{t('SETTINGS_DESCRIPTION')}</p>
          </div>
          <Link className="account-card__link" to={ROUTES.home}>{t('PROFILE_BACK_HOME')}</Link>
        </header>

        <section className="settings-page__section" aria-labelledby="settings-language-title">
          <LanguageSelector />
        </section>

        <section className="settings-page__section" aria-labelledby="settings-appearance-title">
          <div>
            <h2 className="account-card__section-title" id="settings-appearance-title">{t('APPEARANCE_TITLE')}</h2>
            <p className="account-card__description">{t('APPEARANCE_DESCRIPTION')}</p>
          </div>
          <div className="settings-page__options" role="group" aria-label={t('APPEARANCE_TITLE')}>
            {SUPPORTED_THEME_PREFERENCES.map(preference => (
              <Button
                key={preference}
                type="button"
                variation={themePreference === preference ? 'primary' : 'secondary'}
                aria-pressed={themePreference === preference}
                onClick={() => setTheme(preference)}
              >
                {t(THEME_PREFERENCE_NAME_KEYS[preference])}
              </Button>
            ))}
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-navigation-title">
          <div>
            <h2 className="account-card__section-title" id="settings-navigation-title">{t('SETTINGS_NAVIGATION_TITLE')}</h2>
            <p className="account-card__description">{t('SETTINGS_NAVIGATION_DESCRIPTION')}</p>
          </div>
          <nav className="settings-page__links" aria-label={t('SETTINGS_NAVIGATION_TITLE')}>
            {session?.user.profiles.length ? (
              <Link className="account-card__action" to={ROUTES.home}>{t('HOME_TITLE')}</Link>
            ) : (
              <Link className="account-card__action" to={ROUTES.createProfile}>{t('CREATE_PROFILE_TITLE')}</Link>
            )}
            <Link className="account-card__action" to={ROUTES.communities}>{t('COMMUNITIES_TITLE')}</Link>
            <Link className="account-card__action" to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</Link>
            <Link className="account-card__action account-card__action--secondary" to={ROUTES.createProfile}>{t('HOME_CREATE_PROFILE')}</Link>
          </nav>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-account-title">
          <div>
            <h2 className="account-card__section-title" id="settings-account-title">{t('SETTINGS_ACCOUNT_TITLE')}</h2>
            <p className="account-card__description">{session?.user.email}</p>
          </div>
          <Button type="button" variation="secondary" onClick={() => void handleSignOut()}>
            {t('AUTH_SIGN_OUT')}
          </Button>
        </section>
      </section>
    </main>
  )
}
