import { useEditorState } from 'react-simple-wysiwyg'

import type {
  UseToolbarCommandButtonOptions,
  UseToolbarCommandButtonResult
} from './useToolbarCommandButton.types'

export function useToolbarCommandButton({
  command
}: UseToolbarCommandButtonOptions): UseToolbarCommandButtonResult {
  const editorState = useEditorState()

  const handleMouseDown: UseToolbarCommandButtonResult['handleMouseDown'] = event => {
    event.preventDefault()
    editorState.$el?.focus()
    document.execCommand(command)
  }

  return { handleMouseDown }
}
