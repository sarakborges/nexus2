export const deleteData = (key: string) => {
  try {
    localStorage.removeItem(`nexus_${key}`)
  } catch {
    console.warn(`Error deleting data: nexus_${key}`)
  }
}
