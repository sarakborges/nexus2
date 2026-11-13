import { useTranslations } from '@/Hooks/Language'
import { useProfileSettingsPage } from './useProfileSettingsPage'
import type { ProfileSettingsPageProps } from './ProfileSettingsPage.component.types'
import { ProfileSettingsMessageAudience } from './ProfileSettingsMessageAudience.component'
import { ProfileSettingsActivityMatrix } from './ProfileSettingsActivityMatrix.component'
import { ProfileSettingsSaveBar } from './ProfileSettingsSaveBar.component'
import './ProfileSettingsPage.style.scss'

export function ProfileSettingsPage({
  profileUrl,
  presentation = 'page'
}: ProfileSettingsPageProps) {
  const { t } = useTranslations()
  const {
    isLoading,
    isError,
    profileName,
    settings,
    isSaving,
    isDirty,
    saveError,
    saveSuccess,
    setMessageAudience,
    toggleActivityType,
    save,
    retry
  } = useProfileSettingsPage(profileUrl)

  const content = (
    <>
      <header className="profile-settings-page__header">
        {presentation === 'page' && <h1>{t('PROFILE_SETTINGS_TITLE')}</h1>}
        <p>{presentation === 'page' && profileName ? profileName + ' · ' : ''}{t('PROFILE_SETTINGS_DESCRIPTION')}</p>
      </header>

      {isLoading && <p role="status">{t('PROFILE_SETTINGS_LOADING')}</p>}
      {isError && (
        <div className="profile-settings-page__feedback" role="alert">
          <p>{t('PROFILE_SETTINGS_LOAD_ERROR')}</p>
          <button type="button" onClick={retry}>{t('REQUEST_RETRY')}</button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <ProfileSettingsMessageAudience
            value={settings.messageAudience}
            onChange={setMessageAudience}
          />

          <ProfileSettingsActivityMatrix
            settings={settings}
            onToggle={toggleActivityType}
          />

          <ProfileSettingsSaveBar
            isDirty={isDirty}
            isSaving={isSaving}
            saveError={saveError}
            saveSuccess={saveSuccess}
            onSave={save}
          />
        </>
      )}
    </>
  )

  if (presentation === 'modal') {
    return <div className="profile-settings-page profile-settings-page--modal">{content}</div>
  }

  return (
    <main className="account-page">
      <section className="account-card profile-settings-page">
        {content}
      </section>
    </main>
  )
}
