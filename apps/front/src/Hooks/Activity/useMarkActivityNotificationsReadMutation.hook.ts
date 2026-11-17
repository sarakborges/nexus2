import type { AuthSession } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markActivityNotificationsRead } from '@/Services/Activity'
import { queryKeys } from '@/Services/Query/queryKeys'

export function useMarkActivityNotificationsReadMutation() {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, string[]>({
    mutationFn: markActivityNotificationsRead,
    onSuccess: (_result, activityIds) => {
      const readIds = new Set(activityIds)
      queryClient.setQueryData<AuthSession | null>(
        queryKeys.auth.session,
        session => session
          ? {
              ...session,
              activities: session.activities.map(activity =>
                readIds.has(activity.id)
                  ? { ...activity, isRead: true }
                  : activity
              )
            }
          : session
      )
    }
  })
}
