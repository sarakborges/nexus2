export type UseAvatarUploadOptions = {
  purpose: 'profile-avatar' | 'community-avatar'
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  errorLabel: string
}
