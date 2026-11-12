import { useTranslations } from '@/Hooks/Language'
import type { TranslationKey } from '@/Types/Translation.type'
import { useProfileSettingsPage } from './useProfileSettingsPage'
import type { ProfileActivityType } from './useProfileSettingsPage.types'
import './ProfileSettingsPage.style.scss'

const ACTIVITY_TYPES: Array<{ type: ProfileActivityType; label: TranslationKey }> = [
  { type: 'profile_post', label: 'PROFILE_SETTINGS_ACTIVITY_POSTS' },
  { type: 'friend_connected', label: 'PROFILE_SETTINGS_ACTIVITY_FRIENDS' },
  { type: 'community_created', label: 'PROFILE_SETTINGS_ACTIVITY_COMMUNITY_CREATED' },
  { type: 'community_membership', label: 'PROFILE_SETTINGS_ACTIVITY_COMMUNITY_JOINED' }
]

export function ProfileSettingsPage() {
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
  } = useProfileSettingsPage()

  return (
    <main className="account-page">
      <section className="account-card profile-settings-page">
        <header className="profile-settings-page__header">
          <h1>{t('PROFILE_SETTINGS_TITLE')}</h1>
          <p>{profileName ? profileName + ' · ' : ''}{t('PROFILE_SETTINGS_DESCRIPTION')}</p>
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
            <section className="profile-settings-page__section" aria-labelledby="profile-message-audience-title">
              <h2 id="profile-message-audience-title">{t('PROFILE_SETTINGS_MESSAGES')}</h2>
              <p>{t('PROFILE_SETTINGS_MESSAGES_DESCRIPTION')}</p>
              <div className="profile-settings-page__radio-group">
                <label>
                  <input
                    type="radio"
                    name="message-audience"
                    value="friends"
                    checked={settings.messageAudience === 'friends'}
                    onChange={() => setMessageAudience('friends')}
                  />
                  <span>{t('PROFILE_SETTINGS_FRIENDS_ONLY')}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="message-audience"
                    value="everyone"
                    checked={settings.messageAudience === 'everyone'}
                    onChange={() => setMessageAudience('everyone')}
                  />
                  <span>{t('PROFILE_SETTINGS_EVERYONE')}</span>
                </label>
              </div>
            </section>

            <section className="profile-settings-page__section" aria-labelledby="profile-feed-settings-title">
              <h2 id="profile-feed-settings-title">{t('PROFILE_SETTINGS_FEED_TITLE')}</h2>
              <p>{t('PROFILE_SETTINGS_FEED_DESCRIPTION')}</p>
              <div className="profile-settings-page__matrix" role="table" aria-label={t('PROFILE_SETTINGS_FEED_TITLE')}>
                <div className="profile-settings-page__row profile-settings-page__row--header" role="row">
                  <span role="columnheader">{t('PROFILE_SETTINGS_ACTIVITY_TYPE')}</span>
                  <span role="columnheader">{t('PROFILE_SETTINGS_YOUR_POSTS')}</span>
                  <span role="columnheader">{t('PROFILE_SETTINGS_FRIENDS_POSTS')}</span>
                </div>
                {ACTIVITY_TYPES.map(activity => (
                  <div className="profile-settings-page__row" role="row" key={activity.type}>
                    <span role="cell">{t(activity.label)}</span>
                    <label role="cell" aria-label={t(activity.label) + ' — ' + t('PROFILE_SETTINGS_YOUR_POSTS')}>
                      <input
                        type="checkbox"
                        checked={settings.publishActivityTypes.includes(activity.type)}
                        onChange={() => toggleActivityType('publishActivityTypes', activity.type)}
                      />
                    </label>
                    <label role="cell" aria-label={t(activity.label) + ' — ' + t('PROFILE_SETTINGS_FRIENDS_POSTS')}>
                      <input
                        type="checkbox"
                        checked={settings.showFriendActivityTypes.includes(activity.type)}
                        onChange={() => toggleActivityType('showFriendActivityTypes', activity.type)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <footer className="profile-settings-page__footer">
              <div aria-live="polite">
                {saveSuccess && <span className="profile-settings-page__success">{t('PROFILE_SETTINGS_SAVED')}</span>}
                {saveError && <span className="profile-settings-page__error">{t('PROFILE_SETTINGS_SAVE_ERROR')}</span>}
              </div>
              <button
                className="profile-settings-page__save"
                type="button"
                disabled={!isDirty || isSaving}
                onClick={save}
              >
                {isSaving ? t('PROFILE_SETTINGS_SAVING') : t('PROFILE_SETTINGS_SAVE')}
              </button>
            </footer>
          </>
        )}
      </section>
    </main>
  )
}
