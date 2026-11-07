import type { AuthenticatedUser, SignInCredentials } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type UseSignInMutationResult = UseMutationResult<
  AuthenticatedUser,
  unknown,
  SignInCredentials
>
