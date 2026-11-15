import { Checkbox } from '@/DesignSystem'

import type { ProfileActivityTypeRowProps } from './ProfileActivityTypeRow.types'

import './ProfileActivityTypeRow.style.scss'

export function ProfileActivityTypeRow({
  label,
  publishLabel,
  friendsLabel,
  publishChecked,
  friendsChecked,
  onPublishChange,
  onFriendsChange
}: ProfileActivityTypeRowProps) {
  return (
    <div className="profile-activity-type-row" role="row">
      <span role="cell">{label}</span>
      <label
        role="cell"
        data-label={publishLabel}
        aria-label={label + ' — ' + publishLabel}
      >
        <Checkbox checked={publishChecked} onChange={onPublishChange} />
      </label>
      <label
        role="cell"
        data-label={friendsLabel}
        aria-label={label + ' — ' + friendsLabel}
      >
        <Checkbox checked={friendsChecked} onChange={onFriendsChange} />
      </label>
    </div>
  )
}
