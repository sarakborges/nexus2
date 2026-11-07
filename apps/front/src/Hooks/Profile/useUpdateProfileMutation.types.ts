import type { CreateProfileInput, Profile } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UpdateProfileMutationVariables = {
  profileId: string
  input: Omit<CreateProfileInput, 'type'>
}

export type UseUpdateProfileMutationResult = UseMutationResult<
  Profile,
  unknown,
  UpdateProfileMutationVariables
>
