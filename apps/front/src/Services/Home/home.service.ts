import type { HomePageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getHomePage(): Promise<HomePageData> {
  const { data } = await api.get<HomePageData>('/home')
  return data
}

export async function createProfilePost(profileId: string, content: string) {
  const { data } = await api.post('/profiles/' + encodeURIComponent(profileId) + '/posts', { content })
  return data
}
