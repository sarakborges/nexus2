import type { RichTextToolbarProps } from './RichTextToolbar.types'
import { InsertImageButton } from './InsertImageButton.component'
import { ToolbarCommandButton } from './ToolbarCommandButton.component'
import { Toolbar } from 'react-simple-wysiwyg'


export function RichTextToolbar({
  imageButtonLabel,
  imageUploadErrorLabel,
  onUploadImage,
  onUploadingChange,
  onOpenHtmlMode
}: RichTextToolbarProps) {
  return (
    <Toolbar>
      <ToolbarCommandButton title="Undo" command="undo">
        ↶
      </ToolbarCommandButton>
      <ToolbarCommandButton title="Redo" command="redo">
        ↷
      </ToolbarCommandButton>
      <span className="rsw-separator" />
      <ToolbarCommandButton title="Bold" command="bold">
        <strong>B</strong>
      </ToolbarCommandButton>
      <ToolbarCommandButton title="Italic" command="italic">
        <em>I</em>
      </ToolbarCommandButton>
      <ToolbarCommandButton title="Underline" command="underline">
        <u>U</u>
      </ToolbarCommandButton>
      <ToolbarCommandButton title="Strike through" command="strikeThrough">
        <s>S</s>
      </ToolbarCommandButton>
      <span className="rsw-separator" />
      <ToolbarCommandButton title="Bullet list" command="insertUnorderedList">
        <span aria-hidden="true">•</span>
      </ToolbarCommandButton>
      <ToolbarCommandButton title="Numbered list" command="insertOrderedList">
        <span aria-hidden="true">1.</span>
      </ToolbarCommandButton>
      <span className="rsw-separator" />
      <InsertImageButton
        label={imageButtonLabel}
        uploadErrorLabel={imageUploadErrorLabel}
        onUploadImage={onUploadImage}
        onUploadingChange={onUploadingChange}
      />
      <ToolbarCommandButton title="Clear formatting" command="removeFormat">
        <span aria-hidden="true">T×</span>
      </ToolbarCommandButton>
      <button
        className="rsw-btn rich-text-editor__toolbar-button rich-text-editor__mode-button"
        type="button"
        title="Edit HTML source"
        aria-label="Edit HTML source"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onOpenHtmlMode}
      >
        <span aria-hidden="true">{'</>'}</span>
      </button>
    </Toolbar>
  )
}
