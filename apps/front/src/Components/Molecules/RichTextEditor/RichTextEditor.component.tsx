import { Fragment, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode, type UIEvent } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useEditorState } from 'react-simple-wysiwyg'
import Editor, { Toolbar } from 'react-simple-wysiwyg'
import { FiImage } from 'react-icons/fi'

import './RichTextEditor.style.scss'

type ToolbarCommandButtonProps = { title: string; command: string; children: ReactNode }

function ToolbarCommandButton({ title, command, children }: ToolbarCommandButtonProps) {
  const editorState = useEditorState()
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    editorState.$el?.focus()
    document.execCommand(command)
  }
  return <button className="rsw-btn rich-text-editor__toolbar-button" type="button" title={title} aria-label={title} onMouseDown={handleMouseDown}>{children}</button>
}

type HtmlModeButtonProps = { onActivate: () => void }
function HtmlModeButton({ onActivate }: HtmlModeButtonProps) {
  return (
    <button className="rsw-btn rich-text-editor__toolbar-button rich-text-editor__mode-button" type="button" title="Edit HTML source" aria-label="Edit HTML source" onMouseDown={event => event.preventDefault()} onClick={onActivate}>
      <span aria-hidden="true">{'</>'}</span>
    </button>
  )
}

type InsertImageButtonProps = { label: string; uploadErrorLabel: string; onUploadImage: (file: File) => Promise<string>; onUploadingChange: (isUploading: boolean) => void }
function InsertImageButton({ label, uploadErrorLabel, onUploadImage, onUploadingChange }: InsertImageButtonProps) {
  const editorState = useEditorState()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const isRequestPending = useIsFetching() > 0 || useIsMutating() > 0
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (isRequestPending || isUploading) return
    const selection = window.getSelection()
    selectionRef.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
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
      <button className="rsw-btn rich-text-editor__toolbar-button" type="button" title={label} aria-label={label} disabled={isRequestPending || isUploading} onMouseDown={handleMouseDown}><FiImage aria-hidden="true" /></button>
      <input ref={inputRef} className="rich-text-editor__file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label={label} onChange={event => void handleFileChange(event)} />
      {error && <span className="rich-text-editor__upload-error" role="alert">{error}</span>}
    </>
  )
}

function highlightTag(tag: string, key: number): ReactNode {
  const match = tag.match(/^(<\\/?)([A-Za-z][\\w:-]*)([\\s\\S]*?)(\\/?>)$/)
  if (!match) return <span className="rich-text-editor__token rich-text-editor__token--tag" key={key}>{tag}</span>
  const [, opening, name, rawAttributes, closing] = match
  const attributes: ReactNode[] = []
  const attributePattern = /([A-Za-z_:][\\w:.-]*)(\\s*=\\s*)((?:"[^"]*")|(?:'[^']*')|(?:[^\\s>]+))/g
  let cursor = 0
  let attributeIndex = 0
  for (const attribute of rawAttributes.matchAll(attributePattern)) {
    const start = attribute.index ?? 0
    if (start > cursor) attributes.push(rawAttributes.slice(cursor, start))
    attributes.push(<Fragment key={attributeIndex++}><span className="rich-text-editor__token rich-text-editor__token--attribute">{attribute[1]}</span><span className="rich-text-editor__token rich-text-editor__token--punctuation">{attribute[2]}</span><span className="rich-text-editor__token rich-text-editor__token--string">{attribute[3]}</span></Fragment>)
    cursor = start + attribute[0].length
  }
  if (cursor < rawAttributes.length) attributes.push(rawAttributes.slice(cursor))
  return <Fragment key={key}><span className="rich-text-editor__token rich-text-editor__token--tag">{opening}</span><span className="rich-text-editor__token rich-text-editor__token--name">{name}</span>{attributes}<span className="rich-text-editor__token rich-text-editor__token--tag">{closing}</span></Fragment>
}

function highlightHtml(source: string): ReactNode[] {
  const pattern = /<!--[\\s\\S]*?-->|<!doctype\\b[^>]*>|<\\/?[A-Za-z][^>]*>|&(?:#\\d+|#x[\\da-f]+|[A-Za-z][\\w]+);/gi
  const pieces: ReactNode[] = []
  let cursor = 0
  let key = 0
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) pieces.push(source.slice(cursor, start))
    const token = match[0]
    if (token.startsWith('<!--')) pieces.push(<span className="rich-text-editor__token rich-text-editor__token--comment" key={key++}>{token}</span>)
    else if (token.startsWith('&')) pieces.push(<span className="rich-text-editor__token rich-text-editor__token--entity" key={key++}>{token}</span>)
    else if (/^<!doctype/i.test(token)) pieces.push(<span className="rich-text-editor__token rich-text-editor__token--doctype" key={key++}>{token}</span>)
    else pieces.push(highlightTag(token, key++))
    cursor = start + token.length
  }
  if (cursor < source.length) pieces.push(source.slice(cursor))
  if (source.endsWith('\\n')) pieces.push('\\u200b')
  return pieces
}

type HtmlSourceEditorProps = { value: string; onChange: (value: string) => void; disabled: boolean; id: string }
function HtmlSourceEditor({ value, onChange, disabled, id }: HtmlSourceEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, value.split('\\n').length)
  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget
    if (highlightRef.current) { highlightRef.current.scrollTop = target.scrollTop; highlightRef.current.scrollLeft = target.scrollLeft }
    if (gutterRef.current) gutterRef.current.scrollTop = target.scrollTop
  }
  return (
    <div className="rich-text-editor__html-editor">
      <div ref={gutterRef} className="rich-text-editor__line-numbers" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
      <div className="rich-text-editor__code-surface">
        <pre ref={highlightRef} className="rich-text-editor__highlight" aria-hidden="true">{highlightHtml(value)}</pre>
        <textarea id={id + '-html-source'} className="rich-text-editor__html-source" aria-label="HTML source editor" spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} onScroll={syncScroll} wrap="off" />
      </div>
    </div>
  )
}

type RichTextEditorProps = { id: string; value: string; onChange: (value: string) => void; imageButtonLabel: string; imageUploadErrorLabel: string; onUploadImage: (file: File) => Promise<string>; maxTextLength?: number; placeholder?: string }
export function RichTextEditor({ id, value, onChange, imageButtonLabel, imageUploadErrorLabel, onUploadImage, maxTextLength, placeholder }: RichTextEditorProps) {
  const isRequestPending = useIsFetching() > 0 || useIsMutating() > 0
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [isHtmlMode, setIsHtmlMode] = useState(false)
  const handleChange = (nextValue: string) => {
    if (maxTextLength !== undefined) {
      const text = nextValue.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").trim()
      if (text.length > maxTextLength) return
    }
    onChange(nextValue)
  }
  return (
    <div className="rich-text-editor" data-editor-id={id}>
      {isHtmlMode ? (
        <div className="rich-text-editor__html-mode">
          <header className="rich-text-editor__html-toolbar"><span><strong>HTML</strong><small>Source editor</small></span><button className="rich-text-editor__visual-mode-button" type="button" onClick={() => setIsHtmlMode(false)}>Visual editor</button></header>
          <HtmlSourceEditor value={value} onChange={handleChange} disabled={isRequestPending} id={id} />
        </div>
      ) : (
        <fieldset className="rich-text-editor__fieldset" disabled={isRequestPending || isImageUploading}>
          <Editor id={id} role="textbox" aria-multiline="true" aria-labelledby={id + '-label'} value={value} onChange={event => handleChange(event.target.value)} placeholder={placeholder} containerProps={{ className: 'rich-text-editor__container' }}>
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
              <InsertImageButton label={imageButtonLabel} uploadErrorLabel={imageUploadErrorLabel} onUploadImage={onUploadImage} onUploadingChange={setIsImageUploading} />
              <ToolbarCommandButton title="Clear formatting" command="removeFormat"><span aria-hidden="true">T×</span></ToolbarCommandButton>
              <HtmlModeButton onActivate={() => setIsHtmlMode(true)} />
            </Toolbar>
          </Editor>
        </fieldset>
      )}
    </div>
  )
}
