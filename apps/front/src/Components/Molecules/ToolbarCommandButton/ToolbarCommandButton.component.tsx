import type { ToolbarCommandButtonProps } from './ToolbarCommandButton.types'
import { useToolbarCommandButton } from './useToolbarCommandButton'

export function ToolbarCommandButton({
  title,
  command,
  children
}: ToolbarCommandButtonProps) {
  const { handleMouseDown, isActive } = useToolbarCommandButton({ command })

  return (
    <button
      className="rsw-btn rich-text-editor__toolbar-button"
      data-active={isActive ? 'true' : 'false'}
      aria-pressed={isActive}
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={handleMouseDown}
    >
      {children}
    </button>
  )
}
