import type { QueryClient } from '@tanstack/react-query'

export async function invalidateCommunityForumQueries(
  queryClient: QueryClient,
  communityId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ['community-forum', communityId]
  })
}
