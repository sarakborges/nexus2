import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_BFF_URL ?? '/api',
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  paramsSerializer: { indexes: null }
})

export function getApiErrorCode(error: unknown, fallback = 'REQUEST_FAILED'): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return typeof message === 'string' ? message : fallback
  }
  return error instanceof Error ? error.message : fallback
}
