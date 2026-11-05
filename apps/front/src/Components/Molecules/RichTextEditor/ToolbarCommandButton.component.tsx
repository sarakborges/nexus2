import type { ToolbarCommandButtonProps } from './ToolbarCommandButton.types'
import { useEditorState } from 'react-simple-wysiwyg'

import type { MouseEvent } from 'react'

export function ToolbarCommandButton({
  title,
  command,
  children
}: ToolbarCommandButtonProps) {
  const editorState = useEditorState()

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    editorState.$el?.focus()
    document.execCommand(command)
  }

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
