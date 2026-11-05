import { Toast } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useToastViewport } from './useToastViewport'

import './ToastViewport.style.scss'

export function ToastViewport() {
  const { t } = useTranslations()
  const { items, dismissToast } = useToastViewport()

  if (!items.length) return null

  return (
    <aside className="toast-viewport" aria-label={t('TOAST_NOTIFICATIONS')}>
      {items.map((item) => (
        <Toast
          key={item.id}
          duration={4500}
          tone={item.tone}
          role={item.tone === 'error' ? 'alert' : 'status'}
          onDismiss={() => dismissToast(item.id)}
        >
          {item.message}
        </Toast>
      ))}
    </aside>
  )
}
