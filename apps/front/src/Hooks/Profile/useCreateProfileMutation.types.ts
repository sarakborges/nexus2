import type { CreateProfileInput, CreateProfileResult } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UseCreateProfileMutationResult = UseMutationResult<
  CreateProfileResult,
  unknown,
  CreateProfileInput
>
