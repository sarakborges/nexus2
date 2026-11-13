import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileSettingsMessageAudienceProps } from './ProfileSettingsMessageAudience.types'

export function ProfileSettingsMessageAudience({
  value,
  onChange
}: ProfileSettingsMessageAudienceProps) {
  const { t } = useTranslations()

  return (
    <section className="profile-settings-page__section">
      <p>{t('PROFILE_SETTINGS_MESSAGES_DESCRIPTION')}</p>
      <PreferenceSelector title={t('PROFILE_SETTINGS_MESSAGES')}>
        <PreferenceOption
          label={t('PROFILE_SETTINGS_FRIENDS_ONLY')}
          isSelected={value === 'friends'}
          onSelect={() => onChange('friends')}
        />
        <PreferenceOption
          label={t('PROFILE_SETTINGS_EVERYONE')}
          isSelected={value === 'everyone'}
          onSelect={() => onChange('everyone')}
        />
      </PreferenceSelector>
    </section>
  )
}
