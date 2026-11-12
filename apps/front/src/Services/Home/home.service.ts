import { api } from '../Http/api'

export async function createProfilePost(profileId: string, content: string) {
  const { data } = await api.post('/profiles/' + encodeURIComponent(profileId) + '/posts', { content })
  return data
}
