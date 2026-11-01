export const saveData = ({ key, value }: { key: string; value: unknown }) => {
  try {
    localStorage.setItem(`itdw_${key}`, JSON.stringify(value))
  } catch {
    console.warn(`Error saving data: itdw_${key}`)
    console.warn(value)
  }
}
