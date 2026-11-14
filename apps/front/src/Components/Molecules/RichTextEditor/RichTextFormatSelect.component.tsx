import { useRef, useState } from 'react'
import { useEditorState } from 'react-simple-wysiwyg'
import type { RichTextFormatSelectProps } from './RichTextFormatSelect.types'

export function RichTextFormatSelect({ command, label, options }: RichTextFormatSelectProps) {
  const editorState = useEditorState()
  const savedRange = useRef<Range | null>(null)
  const [value, setValue] = useState('')
  const rememberSelection = () => {
    const selection = window.getSelection()
    savedRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
  }
  const applyFormat = (nextValue: string) => {
    if (!nextValue) return
    const editor = editorState.$el
    const selection = window.getSelection()
    const range = savedRange.current
    if (!editor || !selection || !range || !editor.contains(range.commonAncestorContainer)) return
    editor.focus()
    selection.removeAllRanges()
    selection.addRange(range)
    document.execCommand(command, false, nextValue)
    editor.focus()
    setValue('')
  }
  return (
    <select className="rsw-dd rich-text-editor__format-select" aria-label={label} title={label} value={value} onMouseDown={rememberSelection} onChange={event => applyFormat(event.target.value)}>
      <option value="">{label}</option>
      {options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>
  )
}
