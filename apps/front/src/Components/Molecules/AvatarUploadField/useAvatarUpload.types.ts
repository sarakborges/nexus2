export type UseAvatarUploadOptions = {
  purpose: 'profile-avatar' | 'community-avatar'
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  errorLabel: string
}

import type { ChangeEvent } from 'react'

export type UseAvatarUploadController = {
  busy: boolean
  error: string
  handleFileChange: (file: File) => Promise<void>
  handleInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleRemove: () => Promise<void>
}
