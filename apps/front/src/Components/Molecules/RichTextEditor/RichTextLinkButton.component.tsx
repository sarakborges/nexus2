import type { MouseEvent } from 'react'
import { useEditorState } from 'react-simple-wysiwyg'
import type { RichTextLinkButtonProps } from './RichTextLinkButton.types'

export function RichTextLinkButton({ label, promptLabel }: RichTextLinkButtonProps) {
  const editorState = useEditorState()
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const editor = editorState.$el
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    const selectedNode = selection?.anchorNode
    const selectedElement = selectedNode instanceof Element ? selectedNode : selectedNode?.parentElement
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
  }
  return <button className="rsw-btn rich-text-editor__toolbar-button" type="button" title={label} aria-label={label} onMouseDown={handleMouseDown}><span aria-hidden="true">↗</span></button>
}
