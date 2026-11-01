export const loadSession = (key: string) => {
  try {
    const data = sessionStorage.getItem(`itdw_${key}`) || ''

    if (!data) {
      return false
    }

    return JSON.parse(data)
  } catch {
    console.warn(`Error loading session: itdw_${key}`)
  }
}
