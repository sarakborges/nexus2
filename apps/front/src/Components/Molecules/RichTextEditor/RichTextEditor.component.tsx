import type { MouseEvent } from 'react'
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
  promptLabel: string
}

function InsertImageButton({ label, promptLabel }: InsertImageButtonProps) {
  const editorState = useEditorState()

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    editorState.$el?.focus()

    const source = window.prompt(promptLabel)
    if (!source) return

    try {
      const imageUrl = new URL(source.trim())
      if (imageUrl.protocol !== 'https:' && imageUrl.protocol !== 'http:') return
      if (imageUrl.username || imageUrl.password) return

      editorState.$el?.focus()
      document.execCommand('insertImage', false, imageUrl.toString())
    } catch {
      // Invalid image URLs are ignored. The server validates the HTML again.
    }
  }

  return (
    <button
      className="rsw-btn"
      type="button"
      title={label}
      aria-label={label}
      tabIndex={-1}
      onMouseDown={handleMouseDown}
    >
      <FiImage aria-hidden="true" />
    </button>
  )
}

type RichTextEditorProps = {
  id: string
  value: string
  onChange: (value: string) => void
  imageButtonLabel: string
  imageUrlPrompt: string
  maxTextLength?: number
  placeholder?: string
}

export function RichTextEditor({
  id,
  value,
  onChange,
  imageButtonLabel,
  imageUrlPrompt,
  maxTextLength,
  placeholder
}: RichTextEditorProps) {
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
      <Editor
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={`${id}-label`}
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
          <InsertImageButton label={imageButtonLabel} promptLabel={imageUrlPrompt} />
          <BtnClearFormatting />
          <HtmlButton />
        </Toolbar>
      </Editor>
    </div>
  )
}
