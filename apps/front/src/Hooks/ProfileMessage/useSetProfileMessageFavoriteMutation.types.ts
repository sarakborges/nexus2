import type { ProfileMessage } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UseSetProfileMessageFavoriteMutationOptions = {
  profileUrl: string
}

export type SetProfileMessageFavoriteMutationVariables = {
  recipientProfileId: string
  messageId: string
  actorProfileId: string
  isFavorite: boolean
}

export type UseSetProfileMessageFavoriteMutationResult = UseMutationResult<
  ProfileMessage,
  unknown,
  SetProfileMessageFavoriteMutationVariables
>
