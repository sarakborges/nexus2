import { lazy, Suspense, useState } from 'react'

import { ToastViewport } from '@/Components/Organisms/ToastViewport'
import { AppRoutes } from '@/Routes'

import { useAppInitialization } from './useAppInitialization'

const FloatingNavigationBar = lazy(() =>
  import('@/Components/Organisms/FloatingNavigationBar').then(module => ({
    default: module.FloatingNavigationBar
  }))
)

const SettingsModal = lazy(() =>
  import('@/Components/Organisms/SettingsModal').then(module => ({
    default: module.SettingsModal
  }))
)

const ProfileSettingsModal = lazy(() =>
  import('@/Components/Organisms/ProfileSettingsModal').then(module => ({
    default: module.ProfileSettingsModal
  }))
)

export function App() {
  const { hasAuthenticatedSession, shouldInitializeAuth } =
    useAppInitialization()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false)

  return (
    <>
      {hasAuthenticatedSession && shouldInitializeAuth && (
        <Suspense fallback={null}>
          <FloatingNavigationBar
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
          />
        </Suspense>
      )}
      <AppRoutes />
      <ToastViewport />
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open onClose={() => setIsSettingsOpen(false)} />
        </Suspense>
      )}
      {isProfileSettingsOpen && (
        <Suspense fallback={null}>
          <ProfileSettingsModal
            open
            onClose={() => setIsProfileSettingsOpen(false)}
          />
        </Suspense>
      )}
    </>
  )
}
