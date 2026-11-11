import { BadRequestException } from '@nestjs/common'
import { UPLOAD_REFERENCE } from './uploads.constants'
import type {
  EditorMessageParticipants,
  UploadResourceReference,
  UploadResourceType,
  UploadedFileRecord
} from './uploads.types'

export function attachEditorImages(
  records: UploadedFileRecord[],
  userId: string,
  html: string,
  resourceType: UploadResourceType,
  resourceId: string,
  messageParticipants?: EditorMessageParticipants
): UploadedFileRecord[] {
  const ids = getEditorImageIds(html)
  if (!ids.length) return records

  const idSet = new Set(ids)
  for (const id of ids) getReadyEditorImage(records, userId, id)

  return records.map(item => idSet.has(item.id)
    ? {
        ...item,
        resourceType,
        resourceId,
        messageFromProfileId: messageParticipants?.fromProfileId ?? null,
        messageToProfileId: messageParticipants?.toProfileId ?? null
      }
    : item)
}

export function detachEditorImages(
  records: UploadedFileRecord[],
  html: string,
  resourceType: UploadResourceType,
  resourceId: string
): UploadedFileRecord[] {
  const ids = new Set([...html.matchAll(new RegExp(UPLOAD_REFERENCE.source, 'gi'))]
    .map(match => match[2]))

  if (!ids.size) return records

  return records.map(item =>
    ids.has(item.id) &&
    item.purpose === 'editor-image' &&
    item.resourceType === resourceType &&
    item.resourceId === resourceId
      ? {
          ...item,
          resourceType: null,
          resourceId: null,
          messageFromProfileId: null,
          messageToProfileId: null
        }
      : item
  )
}

export function detachResourceAttachments(
  records: UploadedFileRecord[],
  userId: string | null,
  resources: UploadResourceReference[]
): UploadedFileRecord[] {
  if (!resources.length) return records

  const resourceKeys = new Set(resources.map(resource =>
    JSON.stringify([resource.resourceType, resource.resourceId])
  ))

  return records.map(item =>
    (!userId || item.ownerUserId === userId) &&
    resourceKeys.has(JSON.stringify([item.resourceType, item.resourceId]))
      ? {
          ...item,
          resourceType: null,
          resourceId: null,
          messageFromProfileId: null,
          messageToProfileId: null
        }
      : item
  )
}

function getReadyEditorImage(
  records: UploadedFileRecord[],
  userId: string,
  id: string
): UploadedFileRecord {
  const file = records.find(item =>
    item.id === id &&
    item.ownerUserId === userId &&
    item.purpose === 'editor-image' &&
    item.status === 'ready'
  )
  if (!file || (file.expiresAt !== null && file.expiresAt <= Date.now())) {
    throw new BadRequestException('INVALID_EDITOR_IMAGE')
  }
  if (file.resourceType) throw new BadRequestException('EDITOR_IMAGE_ALREADY_ATTACHED')
  return file
}

export function getEditorImageIds(html: string): string[] {
  return [...html.matchAll(UPLOAD_REFERENCE)]
    .map(match => match[2])
    .filter((id, index, ids) => ids.indexOf(id) === index)
}
