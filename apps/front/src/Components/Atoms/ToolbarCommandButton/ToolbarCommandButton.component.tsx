import type { ToolbarCommandButtonProps } from './ToolbarCommandButton.types'
import { useToolbarCommandButton } from './useToolbarCommandButton'
import { Button } from '@/DesignSystem'

export function ToolbarCommandButton({
  title,
  command,
  children
}: ToolbarCommandButtonProps) {
  const { handleMouseDown, isActive } = useToolbarCommandButton({ command })

  return (
    <Button
      variation="transparent"
      className="rsw-btn rich-text-editor__toolbar-button"
      data-active={isActive ? 'true' : 'false'}
      aria-pressed={isActive}
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={handleMouseDown}
    >
      {children}
    </Button>
  )
}
