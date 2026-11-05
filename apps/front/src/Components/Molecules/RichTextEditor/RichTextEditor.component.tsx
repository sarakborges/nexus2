import type { RichTextEditorProps } from './RichTextEditor.types'
import { HtmlSourceEditor } from './HtmlSourceEditor.component'
import { RichTextToolbar } from './RichTextToolbar.component'
import { getRichTextPlainText } from './richText.utils'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import Editor from 'react-simple-wysiwyg'

import { useState } from 'react'

import './RichTextEditor.style.scss'

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
  const [isHtmlMode, setIsHtmlMode] = useState(false)

  const handleChange = (nextValue: string) => {
    if (
      maxTextLength !== undefined &&
      getRichTextPlainText(nextValue).length > maxTextLength
    )
      return
    onChange(nextValue)
  }

  return (
    <div className="rich-text-editor" data-editor-id={id}>
      {isHtmlMode ? (
        <div className="rich-text-editor__html-mode">
          <header className="rich-text-editor__html-toolbar">
            <span>
              <strong>HTML</strong>
              <small>Source editor</small>
            </span>
            <button
              className="rich-text-editor__visual-mode-button"
              type="button"
              onClick={() => setIsHtmlMode(false)}
            >
              Visual editor
            </button>
          </header>
          <HtmlSourceEditor
            id={id}
            value={value}
            onChange={handleChange}
            disabled={isRequestPending}
          />
        </div>
      ) : (
        <fieldset
          className="rich-text-editor__fieldset"
          disabled={isRequestPending || isImageUploading}
        >
          <Editor
            id={id}
            role="textbox"
            aria-multiline="true"
            aria-labelledby={id + '-label'}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            placeholder={placeholder}
            containerProps={{ className: 'rich-text-editor__container' }}
          >
            <RichTextToolbar
              imageButtonLabel={imageButtonLabel}
              imageUploadErrorLabel={imageUploadErrorLabel}
              onUploadImage={onUploadImage}
              onUploadingChange={setIsImageUploading}
              onOpenHtmlMode={() => setIsHtmlMode(true)}
            />
          </Editor>
        </fieldset>
      )}
    </div>
  )
}
