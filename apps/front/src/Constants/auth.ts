import type { AuthErrorCode } from '@/Types/Auth.type'
import type { TranslationKey } from '@/Types/Translation.type'

export const AUTH_ERROR_TRANSLATION_KEYS = {
  EMAIL_ALREADY_EXISTS: 'AUTH_ERROR_EMAIL_EXISTS',
  INVALID_CREDENTIALS: 'AUTH_ERROR_INVALID_CREDENTIALS',
  STORAGE_UNAVAILABLE: 'AUTH_ERROR_STORAGE',
  CRYPTO_UNAVAILABLE: 'AUTH_ERROR_CRYPTO',
  NETWORK_ERROR: 'AUTH_ERROR_GENERIC'
} as const satisfies Record<AuthErrorCode, TranslationKey>
