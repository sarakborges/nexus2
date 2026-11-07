import type { Community, CreateCommunityInput } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type CreateCommunityMutationVariables = {
  input: CreateCommunityInput
  ownerProfileId: string
}

export type UseCreateCommunityMutationResult = UseMutationResult<
  Community,
  unknown,
  CreateCommunityMutationVariables
>
