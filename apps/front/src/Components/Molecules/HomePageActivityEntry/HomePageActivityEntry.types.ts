import type { RecentActivity } from '@nexus/common'

export type HomePageActivityEntryProps = {
  activity: RecentActivity
  formatDate: (timestamp: number) => string
}
