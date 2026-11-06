import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityPrivacySelectorProps } from './CommunityPrivacySelector.types'

export function CommunityPrivacySelector({
  value,
  onChange
}: CommunityPrivacySelectorProps) {
  const { t } = useTranslations()

  return (
    <PreferenceSelector title={t('COMMUNITY_PRIVACY_LABEL')}>
      <PreferenceOption
        label={t('COMMUNITY_PRIVACY_PUBLIC')}
        description={t('COMMUNITY_PRIVACY_PUBLIC_DESCRIPTION')}
        isSelected={value === 'public'}
        onSelect={() => onChange('public')}
      />
      <PreferenceOption
        label={t('COMMUNITY_PRIVACY_PRIVATE')}
        description={t('COMMUNITY_PRIVACY_PRIVATE_DESCRIPTION')}
        isSelected={value === 'private'}
        onSelect={() => onChange('private')}
      />
      <PreferenceOption
        label={t('COMMUNITY_PRIVACY_UNLISTED')}
        description={t('COMMUNITY_PRIVACY_UNLISTED_DESCRIPTION')}
        isSelected={value === 'unlisted'}
        onSelect={() => onChange('unlisted')}
      />
    </PreferenceSelector>
  )
}
