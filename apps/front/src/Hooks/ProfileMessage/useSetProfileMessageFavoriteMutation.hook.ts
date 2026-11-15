import { useMutation, useQueryClient } from '@tanstack/react-query'

import { setProfileMessageFavorite } from '@/Services/ProfileMessage'
import type {
  SetProfileMessageFavoriteMutationVariables,
  UseSetProfileMessageFavoriteMutationOptions,
  UseSetProfileMessageFavoriteMutationResult
} from './useSetProfileMessageFavoriteMutation.types'

export function useSetProfileMessageFavoriteMutation({
  profileUrl
}: UseSetProfileMessageFavoriteMutationOptions): UseSetProfileMessageFavoriteMutationResult {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ recipientProfileId, messageId, actorProfileId, isFavorite }: SetProfileMessageFavoriteMutationVariables) =>
      setProfileMessageFavorite(recipientProfileId, messageId, actorProfileId, isFavorite),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['profile-messages-page', profileUrl]
      })
    }
  })
}
