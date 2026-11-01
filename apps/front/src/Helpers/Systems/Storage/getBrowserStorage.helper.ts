export type BrowserStorageType = 'local' | 'session'

export const getBrowserStorage = (
  type: BrowserStorageType
): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return type === 'local' ? window.localStorage : window.sessionStorage
  } catch (error) {
    console.warn(`Unable to access ${type} storage.`, error)
    return null
  }
}
