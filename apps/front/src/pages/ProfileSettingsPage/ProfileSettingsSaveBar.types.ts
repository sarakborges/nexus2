export type ProfileSettingsSaveBarProps = {
  isDirty: boolean
  isSaving: boolean
  saveError: boolean
  saveSuccess: boolean
  onSave: () => void
}
