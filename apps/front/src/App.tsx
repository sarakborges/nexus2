import { lazy, Suspense, useState } from 'react'

import '@/Components/Molecules/ProfileTypeNotice/ProfileTypeNotice.style.scss'
import { ToastViewport } from '@/Components/Organisms/Toast/ToastViewport.component'
import { AppRoutes } from '@/routes'

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
  import('@/pages/ProfileSettingsPage').then(module => ({
    default: module.ProfileSettingsModal
  }))
)

export function App() {
  const { hasAuthenticatedSession, shouldInitializeAuth } =
    useAppInitialization()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [profileSettingsUrl, setProfileSettingsUrl] = useState<string | null>(null)

  return (
    <>
      {hasAuthenticatedSession && shouldInitializeAuth && (
        <Suspense fallback={null}>
          <FloatingNavigationBar
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenProfileSettings={setProfileSettingsUrl}
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
      {profileSettingsUrl && (
        <Suspense fallback={null}>
          <ProfileSettingsModal
            open
            profileUrl={profileSettingsUrl}
            onClose={() => setProfileSettingsUrl(null)}
          />
        </Suspense>
      )}
    </>
  )
}
