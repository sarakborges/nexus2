import type { UseMutationResult } from '@tanstack/react-query'

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
