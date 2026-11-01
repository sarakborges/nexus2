export const loadData = (key: string) => {
  try {
    const data = localStorage.getItem(`itdw_${key}`) || ''

    if (!data) {
      return false
    }

    return JSON.parse(data)
  } catch {
    console.warn(`Error loading data: itdw_${key}`)
  }
}
