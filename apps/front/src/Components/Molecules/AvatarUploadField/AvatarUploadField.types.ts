export type AvatarUploadFieldProps = {
  label: string
  value: string
  fallbackName: string
  purpose: 'profile-avatar' | 'community-avatar'
  onChange: (value: string) => void
  targetId?: string
  actorProfileId?: string
  selectLabel: string
  changeLabel: string
  removeLabel: string
  uploadingLabel: string
  errorLabel: string
  emptyLabel: string
}
