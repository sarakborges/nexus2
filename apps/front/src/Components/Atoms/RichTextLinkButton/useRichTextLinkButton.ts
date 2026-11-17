import { useCallback } from 'react'
import type { MouseEvent } from 'react'
import { useEditorState } from 'react-simple-wysiwyg'

import type {
  UseRichTextLinkButtonOptions,
  UseRichTextLinkButtonResult
} from './useRichTextLinkButton.types'

export function useRichTextLinkButton({
  promptLabel
}: UseRichTextLinkButtonOptions): UseRichTextLinkButtonResult {
  const editorState = useEditorState()

  const handleMouseDown = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const editor = editorState.$el
    if (!editor) return

    editor.focus()
    const selection = window.getSelection()
    const selectedNode = selection?.anchorNode
    const selectedElement = selectedNode instanceof Element
      ? selectedNode
      : selectedNode?.parentElement
    const activeLink = selectedElement?.closest('a')

    if (activeLink && editor.contains(activeLink)) {
      document.execCommand('unlink')
      editor.focus()
      return
    }

    const value = window.prompt(promptLabel, 'https://')
    if (!value?.trim()) return

    document.execCommand('createLink', false, value.trim())
    editor.focus()
  }, [editorState.$el, promptLabel])

  return { handleMouseDown }
}
