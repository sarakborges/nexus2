import { useMutation } from '@tanstack/react-query'

import {
  deleteUploadedFile,
  updateCommunityAvatar,
  updateProfileAvatar,
  uploadFile
} from '@/Services/Uploads'
import type {
  AvatarMutationResult,
  AvatarMutationVariables,
  AvatarPurpose,
  UseAvatarMutationResult
} from './useAvatarMutation.types'

type AvatarMutationTarget = {
  purpose: AvatarPurpose
  targetId?: string
  actorProfileId?: string
}

async function updateAvatar(
  { purpose, targetId, actorProfileId }: AvatarMutationTarget,
  uploadId: string | null
): Promise<{ picture: string }> {
  if (!targetId) throw new Error('AVATAR_TARGET_REQUIRED')

  if (purpose === 'profile-avatar') {
    return updateProfileAvatar(targetId, uploadId)
  }

  if (!actorProfileId) {
    throw new Error('COMMUNITY_ACTOR_PROFILE_REQUIRED')
  }

  return updateCommunityAvatar(targetId, actorProfileId, uploadId)
}

async function runAvatarMutation(
  variables: AvatarMutationVariables
): Promise<AvatarMutationResult> {
  const { purpose, targetId, actorProfileId, pendingUploadId } = variables

  if (variables.action === 'upload') {
    const uploaded = await uploadFile(
      variables.file,
      purpose,
      targetId,
      actorProfileId
    )

    if (targetId) {
      const updated = await updateAvatar(variables, uploaded.id)
      return { picture: updated.picture, pendingUploadId: null }
    }

    if (pendingUploadId) await deleteUploadedFile(pendingUploadId)

    return { picture: uploaded.url, pendingUploadId: uploaded.id }
  }

  if (targetId) {
    const updated = await updateAvatar(variables, null)
    return { picture: updated.picture, pendingUploadId: null }
  }

  if (pendingUploadId) await deleteUploadedFile(pendingUploadId)

  return { picture: '', pendingUploadId: null }
}

export function useAvatarMutation(): UseAvatarMutationResult {
  return useMutation<AvatarMutationResult, unknown, AvatarMutationVariables>({
    mutationFn: runAvatarMutation
  })
}
