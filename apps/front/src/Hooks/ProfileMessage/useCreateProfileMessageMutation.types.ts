import type { ProfileMessage } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

import type { ProfileMessageError } from '@/Services/ProfileMessage'

export type CreateProfileMessageMutationVariables = {
  fromProfileId: string
  toProfileId: string
  content: string
}

export type UseCreateProfileMessageMutationResult = UseMutationResult<
  ProfileMessage,
  ProfileMessageError,
  CreateProfileMessageMutationVariables
>
