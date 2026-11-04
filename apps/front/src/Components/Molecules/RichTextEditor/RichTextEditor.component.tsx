import { useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useEditorState } from 'react-simple-wysiwyg'
import Editor, { Toolbar } from 'react-simple-wysiwyg'
import { FiImage } from 'react-icons/fi'

import './RichTextEditor.style.scss'

type ToolbarCommandButtonProps = {
  title: string
  command: string
  children: ReactNode
}

function ToolbarCommandButton({ title, command, children }: ToolbarCommandButtonProps) {
  const editorState = useEditorState()
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (editorState.htmlMode) return
    editorState.$el?.focus()
    document.execCommand(command)
  }

  return (
    <button
      className="rsw-btn rich-text-editor__toolbar-button"
      type="button"
      title={title}
      aria-label={title}
      disabled={editorState.htmlMode}
      onMouseDown={handleMouseDown}
    >
      {children}
    </button>
  )
}

function HtmlModeButton() {
  const editorState = useEditorState()
  const toggleMode = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    editorState.update({ htmlMode: !editorState.htmlMode })
  }

  return (
    <button
      className="rsw-btn rich-text-editor__toolbar-button"
      type="button"
      title="HTML mode"
      aria-label="HTML mode"
      aria-pressed={editorState.htmlMode}
      data-active={editorState.htmlMode}
      onMouseDown={toggleMode}
    >
      <span aria-hidden="true">{'</>'}</span>
    </button>
  )
}

type InsertImageButtonProps = {
  label: string
  uploadErrorLabel: string
  onUploadImage: (file: File) => Promise<string>
  onUploadingChange: (isUploading: boolean) => void
}

function InsertImageButton({ label, uploadErrorLabel, onUploadImage, onUploadingChange }: InsertImageButtonProps) {
  const editorState = useEditorState()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (editorState.htmlMode || isRequestPending || isUploading) return
    const selection = window.getSelection()
    selectionRef.current = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).cloneRange()
      : null
    editorState.$el?.focus()
    inputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setError('')
    setIsUploading(true)
    onUploadingChange(true)
    try {
      const imageUrl = await onUploadImage(file)
      editorState.$el?.focus()
      const selection = window.getSelection()
      if (selection && selectionRef.current) {
        selection.removeAllRanges()
        selection.addRange(selectionRef.current)
      }
      document.execCommand('insertImage', false, imageUrl)
      selectionRef.current = null
    } catch {
      setError(uploadErrorLabel)
    } finally {
      setIsUploading(false)
      onUploadingChange(false)
    }
  }

  return (
    <>
      <button
        className="rsw-btn rich-text-editor__toolbar-button"
        type="button"
        title={label}
        aria-label={label}
        disabled={isRequestPending || isUploading || editorState.htmlMode}
        onMouseDown={handleMouseDown}
      >
        <FiImage aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        className="rich-text-editor__file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        aria-label={label}
        onChange={event => void handleFileChange(event)}
      />
      {error && <span className="rich-text-editor__upload-error" role="alert">{error}</span>}
    </>
  )
}

type RichTextEditorProps = {
  id: string
  value: string
  onChange: (value: string) => void
  imageButtonLabel: string
  imageUploadErrorLabel: string
  onUploadImage: (file: File) => Promise<string>
  maxTextLength?: number
  placeholder?: string
}

export function RichTextEditor({
  id,
  value,
  onChange,
  imageButtonLabel,
  imageUploadErrorLabel,
  onUploadImage,
  maxTextLength,
  placeholder
}: RichTextEditorProps) {
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
  const [isImageUploading, setIsImageUploading] = useState(false)
  const handleChange = (nextValue: string) => {
    if (maxTextLength !== undefined) {
      const text = nextValue
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .trim()
      if (text.length > maxTextLength) return
    }
    onChange(nextValue)
  }

  return (
    <div className="rich-text-editor" data-editor-id={id}>
      <fieldset className="rich-text-editor__fieldset" disabled={isRequestPending || isImageUploading}>
        <Editor
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={id + '-label'}
          value={value}
          onChange={event => handleChange(event.target.value)}
          placeholder={placeholder}
          containerProps={{ className: 'rich-text-editor__container' }}
        >
          <Toolbar>
            <ToolbarCommandButton title="Undo" command="undo">↶</ToolbarCommandButton>
            <ToolbarCommandButton title="Redo" command="redo">↷</ToolbarCommandButton>
            <span className="rsw-separator" />
            <ToolbarCommandButton title="Bold" command="bold"><strong>B</strong></ToolbarCommandButton>
            <ToolbarCommandButton title="Italic" command="italic"><em>I</em></ToolbarCommandButton>
            <ToolbarCommandButton title="Underline" command="underline"><u>U</u></ToolbarCommandButton>
            <ToolbarCommandButton title="Strike through" command="strikeThrough"><s>S</s></ToolbarCommandButton>
            <span className="rsw-separator" />
            <ToolbarCommandButton title="Bullet list" command="insertUnorderedList"><span aria-hidden="true">•</span></ToolbarCommandButton>
            <ToolbarCommandButton title="Numbered list" command="insertOrderedList"><span aria-hidden="true">1.</span></ToolbarCommandButton>
            <span className="rsw-separator" />
            <InsertImageButton
              label={imageButtonLabel}
              uploadErrorLabel={imageUploadErrorLabel}
              onUploadImage={onUploadImage}
              onUploadingChange={setIsImageUploading}
            />
            <ToolbarCommandButton title="Clear formatting" command="removeFormat"><span aria-hidden="true">T×</span></ToolbarCommandButton>
            <HtmlModeButton />
          </Toolbar>
        </Editor>
      </fieldset>
    </div>
  )
}
