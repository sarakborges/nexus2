export const deleteSession = (key: string) => {
  try {
    sessionStorage.removeItem(`nexus_${key}`)
  } catch {
    console.warn(`Error deleting session: nexus_${key}`)
  }
}
