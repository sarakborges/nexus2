import type { ProfileType } from '@nexus/common'

import { useTranslations } from '@/Hooks/Language'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'

import './ProfileTypeNotice.style.scss'

type Props = { targetType: ProfileType }

export function ProfileTypeNotice({ targetType }: Props) {
  const { t } = useTranslations()
  const { isCompatible, isChecking } = useProfileTypeCompatibility(targetType)
  if (isCompatible || isChecking) return null
  return (
    <p className="profile-type-notice" role="alert">
      {t('PROFILE_TYPE_MISMATCH_NOTICE')}
    </p>
  )
}
