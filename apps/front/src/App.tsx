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

export function App() {
  const { hasAuthenticatedSession, shouldInitializeAuth } =
    useAppInitialization()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <>
      {hasAuthenticatedSession && shouldInitializeAuth && (
        <Suspense fallback={null}>
          <FloatingNavigationBar onOpenSettings={() => setIsSettingsOpen(true)} />
        </Suspense>
      )}
      <AppRoutes />
      <ToastViewport />
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open onClose={() => setIsSettingsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
