import type { RecentActivity } from '@nexus/common'
import { api } from '../Http/api'

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const { data } = await api.get<RecentActivity[]>('/activity')
  return data
}
