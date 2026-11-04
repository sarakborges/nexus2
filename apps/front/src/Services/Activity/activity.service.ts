import { api } from '../Http/api'
import type { RecentActivity } from '@nexus/common'

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const { data } = await api.get<RecentActivity[]>('/activity')
  return data
}
