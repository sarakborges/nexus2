import type { UploadPurpose } from '@/Services/Uploads'
import type { UseMutationResult } from '@tanstack/react-query'

export type AvatarPurpose = Extract<
  UploadPurpose,
  'profile-avatar' | 'community-avatar'
>

type AvatarMutationTarget = {
  purpose: AvatarPurpose
  targetId?: string
  actorProfileId?: string
  pendingUploadId: string | null
}

export type UploadAvatarMutationVariables = AvatarMutationTarget & {
  action: 'upload'
  file: File
}

export type RemoveAvatarMutationVariables = AvatarMutationTarget & {
  action: 'remove'
}

export type AvatarMutationVariables =
  | UploadAvatarMutationVariables
  | RemoveAvatarMutationVariables

export type AvatarMutationResult = {
  picture: string
  pendingUploadId: string | null
}

export type UseAvatarMutationResult = UseMutationResult<
  AvatarMutationResult,
  unknown,
  AvatarMutationVariables
>
