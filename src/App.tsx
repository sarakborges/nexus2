import { useThemePreference } from '@/Hooks/Theme'
import { AppRoutes } from '@/routes'

export function App() {
  useThemePreference()

  return <AppRoutes />
}
