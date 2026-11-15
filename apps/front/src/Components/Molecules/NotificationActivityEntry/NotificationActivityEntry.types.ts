import type { RecentActivity } from '@nexus/common'

export type NotificationActivityEntryProps = {
  activity: RecentActivity
  onClick: () => void
}
