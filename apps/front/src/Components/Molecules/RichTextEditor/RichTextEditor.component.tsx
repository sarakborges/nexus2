import type { RichTextEditorProps } from './RichTextEditor.types'
import { HtmlSourceEditor } from './HtmlSourceEditor.component'
import { RichTextToolbar } from './RichTextToolbar.component'
import { useRichTextEditor } from './useRichTextEditor'
import Editor from 'react-simple-wysiwyg'
import { useTranslations } from '@/Hooks/Language'

import './RichTextEditor.style.scss'

export function RichTextEditor({
  id,
  value,
  onChange,
  imageButtonLabel,
  imageUploadErrorLabel,
  onUploadImage,
  maxHtmlLength,
  placeholder
}: RichTextEditorProps) {
  const {
    isImageUploading,
    isHtmlMode,
    setImageUploading,
    openHtmlMode,
    closeHtmlMode,
    handleChange,
    handleHtmlModeMouseDown
  } = useRichTextEditor({ onChange })
  const { t } = useTranslations()

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
              onClick={closeHtmlMode}
            >
              Visual editor
            </button>
          </header>
          <HtmlSourceEditor
            id={id}
            value={value}
            onChange={handleChange}
            disabled={isImageUploading}
          />
        </div>
      ) : (
        <fieldset
          className="rich-text-editor__fieldset"
          disabled={isImageUploading}
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
              onUploadingChange={setImageUploading}
              onOpenHtmlMode={openHtmlMode}
              onHtmlModeMouseDown={handleHtmlModeMouseDown}
            />
          </Editor>
        </fieldset>
      )}
      {maxHtmlLength !== undefined && (
        <p className={`rich-text-editor__counter ${value.length > maxHtmlLength ? 'is-over-limit' : ''}`} aria-live="polite">
          <span>{t('RICH_TEXT_HTML_CHARACTER_COUNT', { count: value.length.toLocaleString(), max: maxHtmlLength.toLocaleString() })}</span>
          {value.length > maxHtmlLength && <strong>{t('RICH_TEXT_HTML_CHARACTER_LIMIT')}</strong>}
        </p>
      )}
    </div>
  )
}
