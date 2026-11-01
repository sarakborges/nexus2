import { loadData, saveData } from '@/Helpers/Systems/Data'
import type { ProfileMessage } from '@/Models/ProfileMessage.model'

const PROFILE_MESSAGES_KEY = 'profile_messages'
const MAX_MESSAGE_LENGTH = 4000

export type ProfileMessageErrorCode =
  | 'INVALID_MESSAGE'
  | 'STORAGE_UNAVAILABLE'

export class ProfileMessageError extends Error {
  code: ProfileMessageErrorCode

  constructor(code: ProfileMessageErrorCode) {
    super(code)
    this.name = 'ProfileMessageError'
    this.code = code
  }
}

const createId = (): string => {
  if (typeof globalThis.crypto === 'undefined') {
    throw new ProfileMessageError('STORAGE_UNAVAILABLE')
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const parseMessage = (value: unknown): ProfileMessage | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const message = value as Record<string, unknown>

  if (
    typeof message.id !== 'string' ||
    typeof message.fromProfileId !== 'string' ||
    typeof message.toProfileId !== 'string' ||
    typeof message.content !== 'string' ||
    typeof message.createdAt !== 'number' ||
    !Number.isFinite(message.createdAt) ||
    !message.content.trim() ||
    message.content.length > MAX_MESSAGE_LENGTH
  ) {
    return null
  }

  return {
    id: message.id,
    fromProfileId: message.fromProfileId,
    toProfileId: message.toProfileId,
    content: message.content,
    createdAt: message.createdAt
  }
}

export const getProfileMessages = (
  profileId: string,
  viewerProfileId: string | null
): ProfileMessage[] => {
  const storedMessages = loadData<unknown>(PROFILE_MESSAGES_KEY)
  if (!Array.isArray(storedMessages)) {
    return []
  }

  const messages = storedMessages
    .map(parseMessage)
    .filter((message): message is ProfileMessage => message !== null)

  if (messages.length !== storedMessages.length) {
    saveProfileMessages(messages)
  }

  return messages
    .filter(
      (message) =>
        message.toProfileId === profileId &&
        (viewerProfileId === profileId ||
          (viewerProfileId !== null &&
            message.fromProfileId === viewerProfileId))
    )
    .sort((first, second) => second.createdAt - first.createdAt)
}

export const getAllProfileMessages = (): ProfileMessage[] => {
  const storedMessages = loadData<unknown>(PROFILE_MESSAGES_KEY)

  if (!Array.isArray(storedMessages)) {
    return []
  }

  return storedMessages
    .map(parseMessage)
    .filter((message): message is ProfileMessage => message !== null)
}

export const saveProfileMessages = (messages: ProfileMessage[]): boolean =>
  saveData({ key: PROFILE_MESSAGES_KEY, value: messages })

export const createProfileMessage = (
  fromProfileId: string,
  toProfileId: string,
  content: string
): ProfileMessage => {
  const normalizedContent = content.trim()

  if (
    !fromProfileId ||
    !toProfileId ||
    fromProfileId === toProfileId ||
    !normalizedContent ||
    normalizedContent.length > MAX_MESSAGE_LENGTH
  ) {
    throw new ProfileMessageError('INVALID_MESSAGE')
  }

  return {
    id: createId(),
    fromProfileId,
    toProfileId,
    content: normalizedContent,
    createdAt: Date.now()
  }
}
