import { useMutation, useQueryClient } from '@tanstack/react-query'

import { setProfileMessageFavorite } from '@/Services/ProfileMessage'
import type {
  SetProfileMessageFavoriteMutationVariables,
  UseSetProfileMessageFavoriteMutationResult
} from './useSetProfileMessageFavoriteMutation.types'

export function useSetProfileMessageFavoriteMutation(): UseSetProfileMessageFavoriteMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ recipientProfileId, messageId, actorProfileId, isFavorite }: SetProfileMessageFavoriteMutationVariables) =>
      setProfileMessageFavorite(recipientProfileId, messageId, actorProfileId, isFavorite),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile-messages-page'] })
    }
  })
}
