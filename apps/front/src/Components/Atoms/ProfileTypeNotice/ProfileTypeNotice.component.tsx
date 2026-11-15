import type { ProfileTypeNoticeProps } from './ProfileTypeNotice.types'

import './ProfileTypeNotice.style.scss'

export function ProfileTypeNotice({
  isVisible,
  message
}: ProfileTypeNoticeProps) {
  if (!isVisible) return null

  return (
    <p className="profile-type-notice" role="alert">
      {message}
    </p>
  )
}
