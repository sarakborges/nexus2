import type { ProfileSettings } from '@nexus/common'

export type ProfileSettingsMessageAudienceProps = {
  value: ProfileSettings['messageAudience']
  onChange: (value: ProfileSettings['messageAudience']) => void
}
