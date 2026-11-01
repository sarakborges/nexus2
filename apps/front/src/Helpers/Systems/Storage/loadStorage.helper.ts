export const loadStorage = <T>(
  storage: Storage | null,
  key: string
): T | null => {
  if (!storage) {
    return null
  }

  try {
    const value = storage.getItem(key)

    return value === null ? null : (JSON.parse(value) as T)
  } catch (error) {
    console.warn(`Unable to load "${key}" from browser storage.`, error)
    return null
  }
}
