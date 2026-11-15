import { ProfileActivityTypeRow } from '@/Components/Molecules/ProfileActivityTypeRow'
import { useTranslations } from '@/Hooks/Language'
import type { TranslationKey } from '@/Types/Translation.type'
import type { ProfileSettingsActivityMatrixProps, ProfileActivityType } from './ProfileSettingsActivityMatrix.types'
import './ProfileSettingsActivityMatrix.style.scss'

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
  const publishLabel = t('PROFILE_SETTINGS_YOUR_POSTS')
  const friendsLabel = t('PROFILE_SETTINGS_FRIENDS_POSTS')

  return (
    <section className="profile-settings-activity-matrix__section" aria-labelledby="profile-feed-settings-title">
      <h2 id="profile-feed-settings-title">{t('PROFILE_SETTINGS_FEED_TITLE')}</h2>
      <p>{t('PROFILE_SETTINGS_FEED_DESCRIPTION')}</p>
      <div className="profile-settings-activity-matrix__matrix" role="table" aria-label={t('PROFILE_SETTINGS_FEED_TITLE')}>
        <div className="profile-settings-activity-matrix__header" role="row">
          <span role="columnheader">{t('PROFILE_SETTINGS_ACTIVITY_TYPE')}</span>
          <span role="columnheader">{publishLabel}</span>
          <span role="columnheader">{friendsLabel}</span>
        </div>
        {ACTIVITY_TYPES.map(activity => (
          <ProfileActivityTypeRow
            key={activity.type}
            label={t(activity.label)}
            publishLabel={publishLabel}
            friendsLabel={friendsLabel}
            publishChecked={settings.publishActivityTypes.includes(activity.type)}
            friendsChecked={settings.showFriendActivityTypes.includes(activity.type)}
            onPublishChange={() => onToggle('publishActivityTypes', activity.type)}
            onFriendsChange={() => onToggle('showFriendActivityTypes', activity.type)}
          />
        ))}
      </div>
    </section>
  )
}
