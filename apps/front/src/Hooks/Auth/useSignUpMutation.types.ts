import type { AuthenticatedUser, SignUpCredentials } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UseSignUpMutationResult = UseMutationResult<
  AuthenticatedUser,
  unknown,
  SignUpCredentials
>
