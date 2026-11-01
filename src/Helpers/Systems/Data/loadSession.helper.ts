export const loadSession = (key: string) => {
  try {
    const data = sessionStorage.getItem(`nexus_${key}`) || ''

    if (!data) {
      return false
    }

    return JSON.parse(data)
  } catch {
    console.warn(`Error loading session: nexus_${key}`)
  }
}
