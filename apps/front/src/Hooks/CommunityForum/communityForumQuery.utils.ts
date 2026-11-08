import type { QueryClient } from '@tanstack/react-query'

export async function invalidateCommunityForumQueries(
  queryClient: QueryClient,
  communityId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['community-forum', communityId]
    }),
    queryClient.invalidateQueries({
      queryKey: ['community-page']
    })
  ])
}
