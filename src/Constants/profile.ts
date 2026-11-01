import type { ProfileErrorCode } from '@/Types/Profile.type'
import type { TranslationKey } from '@/Types/Translation.type'

export const PROFILE_ERROR_TRANSLATION_KEYS = {
  PROFILE_ALREADY_EXISTS: 'PROFILE_ERROR_ALREADY_EXISTS',
  INVALID_PROFILE: 'PROFILE_ERROR_INVALID',
  STORAGE_UNAVAILABLE: 'PROFILE_ERROR_STORAGE'
} as const satisfies Record<ProfileErrorCode, TranslationKey>
