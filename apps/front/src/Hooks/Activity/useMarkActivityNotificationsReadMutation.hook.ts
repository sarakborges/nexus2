import { useMutation } from '@tanstack/react-query'

import { markActivityNotificationsRead } from '@/Services/Activity'
import { useAuthStore } from '@/Stores/Auth.store'

export function useMarkActivityNotificationsReadMutation() {
  return useMutation<void, unknown, string[]>({
    mutationFn: markActivityNotificationsRead,
    onSuccess: (_result, activityIds) => {
      useAuthStore.getState().markActivitiesRead(activityIds)
    }
  })
}
