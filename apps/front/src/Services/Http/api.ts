import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.DEV
    ? '/api'
    : (import.meta.env.VITE_BFF_URL ?? '/api'),
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  paramsSerializer: { indexes: null }
})

export function getApiErrorCode(
  error: unknown,
  fallback = 'REQUEST_FAILED'
): string {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as
      { message?: unknown; code?: unknown } | undefined
    if (typeof response?.code === 'string' && response.code.trim())
      return response.code
    if (typeof response?.message === 'string' && response.message.trim())
      return response.message
    if (Array.isArray(response?.message)) {
      const firstMessage = response.message.find(
        (item) => typeof item === 'string' && item.trim()
      )
      if (typeof firstMessage === 'string') return firstMessage
    }
    return fallback
  }
  return error instanceof Error ? error.message : fallback
}
