export const saveData = ({ key, value }: { key: string; value: unknown }) => {
  try {
    localStorage.setItem(`nexus_${key}`, JSON.stringify(value))
  } catch {
    console.warn(`Error saving data: nexus_${key}`)
    console.warn(value)
  }
}
