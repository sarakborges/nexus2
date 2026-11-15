import type { ProfileTypeNoticeProps } from './ProfileTypeNotice.types'

import { useTranslations } from '@/Hooks/Language'

import './ProfileTypeNotice.style.scss'

export function ProfileTypeNotice({
  isCompatible,
  isChecking
}: ProfileTypeNoticeProps) {
  const { t } = useTranslations()
  if (isCompatible || isChecking) return null

  return (
    <p className="profile-type-notice" role="alert">
      {t('PROFILE_TYPE_MISMATCH_NOTICE')}
    </p>
  )
}
