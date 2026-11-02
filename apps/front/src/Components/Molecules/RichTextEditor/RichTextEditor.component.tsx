import { useRef, useState, type ChangeEvent, type MouseEvent } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useEditorState } from 'react-simple-wysiwyg'
import Editor, {
  BtnBold,
  BtnBulletList,
  BtnClearFormatting,
  BtnItalic,
  BtnNumberedList,
  BtnStrikeThrough,
  BtnUnderline,
  BtnUndo,
  BtnRedo,
  HtmlButton,
  Toolbar
} from 'react-simple-wysiwyg'
import { FiImage } from 'react-icons/fi'

import './RichTextEditor.style.scss'

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
        className="rsw-btn"
        type="button"
        title={label}
        aria-label={label}
        tabIndex={-1}
        disabled={isRequestPending || isUploading}
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
          <BtnUndo />
          <BtnRedo />
          <span className="rsw-separator" />
          <BtnBold />
          <BtnItalic />
          <BtnUnderline />
          <BtnStrikeThrough />
          <span className="rsw-separator" />
          <BtnBulletList />
          <BtnNumberedList />
          <span className="rsw-separator" />
          <InsertImageButton
            label={imageButtonLabel}
            uploadErrorLabel={imageUploadErrorLabel}
            onUploadImage={onUploadImage}
            onUploadingChange={setIsImageUploading}
          />
          <BtnClearFormatting />
          <HtmlButton />
        </Toolbar>
      </Editor>
      </fieldset>
    </div>
  )
}
