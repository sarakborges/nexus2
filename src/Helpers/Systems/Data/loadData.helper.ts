export const loadData = (key: string) => {
  try {
    const data = localStorage.getItem(`nexus_${key}`) || ''

    if (!data) {
      return false
    }

    return JSON.parse(data)
  } catch {
    console.warn(`Error loading data: nexus_${key}`)
  }
}
