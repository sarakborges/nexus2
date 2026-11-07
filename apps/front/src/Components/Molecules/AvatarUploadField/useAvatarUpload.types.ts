import type { AvatarPurpose } from '@/Hooks/Uploads'
import type { ChangeEvent } from 'react'

export type UseAvatarUploadOptions = {
  purpose: AvatarPurpose
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  errorLabel: string
}

export type UseAvatarUploadController = {
  busy: boolean
  error: string
  handleFileChange: (file: File) => Promise<void>
  handleInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleRemove: () => Promise<void>
}
