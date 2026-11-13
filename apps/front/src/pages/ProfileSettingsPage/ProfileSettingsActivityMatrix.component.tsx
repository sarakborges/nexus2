import { useTranslations } from '@/Hooks/Language'
import type { TranslationKey } from '@/Types/Translation.type'
import type { ProfileSettingsActivityMatrixProps, ProfileActivityType } from './ProfileSettingsActivityMatrix.types'

const ACTIVITY_TYPES: Array<{ type: ProfileActivityType; label: TranslationKey }> = [
  { type: 'profile_post', label: 'PROFILE_SETTINGS_ACTIVITY_POSTS' },
  { type: 'friend_connected', label: 'PROFILE_SETTINGS_ACTIVITY_FRIENDS' },
  { type: 'community_created', label: 'PROFILE_SETTINGS_ACTIVITY_COMMUNITY_CREATED' },
  { type: 'community_membership', label: 'PROFILE_SETTINGS_ACTIVITY_COMMUNITY_JOINED' }
]

export function ProfileSettingsActivityMatrix({
  settings,
  onToggle
}: ProfileSettingsActivityMatrixProps) {
  const { t } = useTranslations()

  return (
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
            <label
              role="cell"
              data-label={t('PROFILE_SETTINGS_YOUR_POSTS')}
              aria-label={t(activity.label) + ' — ' + t('PROFILE_SETTINGS_YOUR_POSTS')}
            >
              <input
                type="checkbox"
                checked={settings.publishActivityTypes.includes(activity.type)}
                onChange={() => onToggle('publishActivityTypes', activity.type)}
              />
            </label>
            <label
              role="cell"
              data-label={t('PROFILE_SETTINGS_FRIENDS_POSTS')}
              aria-label={t(activity.label) + ' — ' + t('PROFILE_SETTINGS_FRIENDS_POSTS')}
            >
              <input
                type="checkbox"
                checked={settings.showFriendActivityTypes.includes(activity.type)}
                onChange={() => onToggle('showFriendActivityTypes', activity.type)}
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  )
}
