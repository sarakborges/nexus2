import { useCallback, useEffect, useState } from 'react'
import { useEditorState } from 'react-simple-wysiwyg'

import type {
  UseToolbarCommandButtonOptions,
  UseToolbarCommandButtonResult
} from './useToolbarCommandButton.types'

export function useToolbarCommandButton({
  command
}: UseToolbarCommandButtonOptions): UseToolbarCommandButtonResult {
  const editorState = useEditorState()
  const [isActive, setIsActive] = useState(false)

  const updateActiveState = useCallback(() => {
    const editor = editorState.$el
    const selection = window.getSelection()
    const anchorNode = selection?.anchorNode

    if (!editor || !anchorNode || !editor.contains(anchorNode)) {
      setIsActive(false)
      return
    }

    try {
      setIsActive(document.queryCommandState(command))
    } catch {
      setIsActive(false)
    }
  }, [command, editorState.$el])

  useEffect(() => {
    const editor = editorState.$el
    if (!editor) return

    editor.addEventListener('keyup', updateActiveState)
    editor.addEventListener('mouseup', updateActiveState)
    editor.addEventListener('input', updateActiveState)
    editor.addEventListener('focus', updateActiveState)
    document.addEventListener('selectionchange', updateActiveState)

    return () => {
      editor.removeEventListener('keyup', updateActiveState)
      editor.removeEventListener('mouseup', updateActiveState)
      editor.removeEventListener('input', updateActiveState)
      editor.removeEventListener('focus', updateActiveState)
      document.removeEventListener('selectionchange', updateActiveState)
    }
  }, [editorState.$el, updateActiveState])

  const handleMouseDown: UseToolbarCommandButtonResult['handleMouseDown'] = event => {
    event.preventDefault()
    editorState.$el?.focus()
    document.execCommand(command)
    updateActiveState()
  }

  return { handleMouseDown, isActive }
}
