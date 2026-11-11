import type { HomePageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getHomePage(): Promise<HomePageData> {
  const { data } = await api.get<HomePageData>('/home')
  return data
}
