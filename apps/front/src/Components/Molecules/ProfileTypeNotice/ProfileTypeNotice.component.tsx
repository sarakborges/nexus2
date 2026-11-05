import type { ProfileTypeNoticeProps } from './ProfileTypeNotice.types'

import { useTranslations } from '@/Hooks/Language'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'

import './ProfileTypeNotice.style.scss'

export function ProfileTypeNotice({ targetType }: ProfileTypeNoticeProps) {
  const { t } = useTranslations()
  const { isCompatible, isChecking } = useProfileTypeCompatibility(targetType)
  if (isCompatible || isChecking) return null
  return (
    <p className="profile-type-notice" role="alert">
      {t('PROFILE_TYPE_MISMATCH_NOTICE')}
    </p>
  )
}
