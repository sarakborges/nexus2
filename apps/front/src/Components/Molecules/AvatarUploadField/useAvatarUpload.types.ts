export type UseAvatarUploadOptions = {
  purpose: 'profile-avatar' | 'community-avatar'
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  errorLabel: string
}

export type UseAvatarUploadController = {
  busy: boolean
  error: string
  handleFileChange: (file: File) => Promise<void>
  handleRemove: () => Promise<void>
}
