import type { UseMutationResult } from '@tanstack/react-query'

export type UseDeleteProfileMessageMutationOptions = {
  profileUrl: string
}

export type DeleteProfileMessageMutationVariables = {
  recipientProfileId: string
  messageId: string
  actorProfileId: string
}

export type UseDeleteProfileMessageMutationResult = UseMutationResult<
  void,
  unknown,
  DeleteProfileMessageMutationVariables
>
