export const deleteStorage = (
  storage: Storage | null,
  key: string
): boolean => {
  if (!storage) {
    return false
  }

  try {
    storage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`Unable to delete "${key}" from browser storage.`, error)
    return false
  }
}
