export const saveStorage = (
  storage: Storage | null,
  key: string,
  value: unknown
): boolean => {
  if (!storage) {
    return false
  }

  try {
    const serializedValue = JSON.stringify(value)

    if (serializedValue === undefined) {
      return false
    }

    storage.setItem(key, serializedValue)
    return true
  } catch (error) {
    console.warn(`Unable to save "${key}" to browser storage.`, error)
    return false
  }
}
