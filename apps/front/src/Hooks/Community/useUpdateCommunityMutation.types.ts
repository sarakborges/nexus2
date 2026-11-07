import type { Community, CreateCommunityInput } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UpdateCommunityMutationVariables = {
  communityId: string
  input: CreateCommunityInput
}

export type UseUpdateCommunityMutationResult = UseMutationResult<
  Community,
  unknown,
  UpdateCommunityMutationVariables
>
