import { useTranslations } from '@/Hooks/Language'
import type { ProfileSettingsMessageAudienceProps } from './ProfileSettingsMessageAudience.types'

export function ProfileSettingsMessageAudience({
  value,
  onChange
}: ProfileSettingsMessageAudienceProps) {
  const { t } = useTranslations()

  return (
    <section className="profile-settings-page__section" aria-labelledby="profile-message-audience-title">
      <h2 id="profile-message-audience-title">{t('PROFILE_SETTINGS_MESSAGES')}</h2>
      <p>{t('PROFILE_SETTINGS_MESSAGES_DESCRIPTION')}</p>
      <div className="profile-settings-page__radio-group">
        <label>
          <input
            type="radio"
            name="message-audience"
            value="friends"
            checked={value === 'friends'}
            onChange={() => onChange('friends')}
          />
          <span>{t('PROFILE_SETTINGS_FRIENDS_ONLY')}</span>
        </label>
        <label>
          <input
            type="radio"
            name="message-audience"
            value="everyone"
            checked={value === 'everyone'}
            onChange={() => onChange('everyone')}
          />
          <span>{t('PROFILE_SETTINGS_EVERYONE')}</span>
        </label>
      </div>
    </section>
  )
}
