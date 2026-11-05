import type { ToolbarCommandButtonProps } from './ToolbarCommandButton.types'
import { useToolbarCommandButton } from './useToolbarCommandButton'

export function ToolbarCommandButton({
  title,
  command,
  children
}: ToolbarCommandButtonProps) {
  const { handleMouseDown } = useToolbarCommandButton({ command })

  return (
    <button
      className="rsw-btn rich-text-editor__toolbar-button"
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={handleMouseDown}
    >
      {children}
    </button>
  )
}
