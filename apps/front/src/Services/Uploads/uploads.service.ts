import { api } from '../Http/api'

export type UploadPurpose =
  'profile-avatar' | 'community-avatar' | 'editor-image'
export type UploadedFile = { id: string; url: string }

const imageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
])

export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  targetId?: string,
  actorProfileId?: string
): Promise<UploadedFile> {
  if (!imageTypes.has(file.type)) throw new Error('INVALID_UPLOAD_TYPE')
  const maxSize =
    purpose === 'editor-image' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
  if (!file.size || file.size > maxSize) throw new Error('INVALID_UPLOAD_SIZE')

  const { data: signed } = await api.post<{ id: string; uploadUrl: string }>(
    '/uploads/presign',
    {
      purpose,
      contentType: file.type,
      size: file.size,
      ...(targetId ? { targetId } : {}),
      ...(actorProfileId ? { actorProfileId } : {})
    }
  )

  try {
    const response = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    })
    if (!response.ok) throw new Error('UPLOAD_TRANSFER_FAILED')

    const { data } = await api.post<UploadedFile>(
      '/uploads/' + signed.id + '/complete'
    )
    return data
  } catch (error) {
    await api.delete('/uploads/' + signed.id).catch(() => undefined)
    throw error
  }
}

export async function deleteUploadedFile(id: string): Promise<void> {
  await api.delete('/uploads/' + encodeURIComponent(id))
}

export async function updateProfileAvatar(
  profileId: string,
  uploadId: string | null
): Promise<{ picture: string }> {
  const { data } = await api.patch<{ picture: string }>(
    '/uploads/profiles/' + encodeURIComponent(profileId) + '/avatar',
    { uploadId }
  )
  return data
}

export async function updateCommunityAvatar(
  communityId: string,
  actorProfileId: string,
  uploadId: string | null
): Promise<{ picture: string }> {
  const { data } = await api.patch<{ picture: string }>(
    '/uploads/communities/' + encodeURIComponent(communityId) + '/avatar',
    { actorProfileId, uploadId }
  )
  return data
}

export async function uploadEditorImage(file: File): Promise<string> {
  const uploaded = await uploadFile(file, 'editor-image')
  return uploaded.url
}
