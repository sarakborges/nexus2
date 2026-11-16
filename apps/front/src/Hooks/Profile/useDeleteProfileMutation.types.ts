import type { AuthSession } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UseDeleteProfileMutationResult = UseMutationResult<
  AuthSession | null,
  unknown,
  string
>
