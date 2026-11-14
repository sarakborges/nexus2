import type { RichTextToolbarProps } from './RichTextToolbar.types'
import { InsertImageButton } from '@/Components/Molecules/InsertImageButton'
import { ToolbarCommandButton } from '@/Components/Molecules/ToolbarCommandButton'
import { RichTextFormatSelect } from '@/Components/Molecules/RichTextFormatSelect'
import { RichTextLinkButton } from '@/Components/Molecules/RichTextLinkButton'
import { Toolbar } from 'react-simple-wysiwyg'
import { useTranslations } from '@/Hooks/Language'

export function RichTextToolbar({
  imageButtonLabel,
  imageUploadErrorLabel,
  onUploadImage,
  onUploadingChange,
  onOpenHtmlMode,
  onHtmlModeMouseDown
}: RichTextToolbarProps) {
  const { t } = useTranslations()
  return (
    <Toolbar>
      <ToolbarCommandButton title={t('RICH_TEXT_UNDO')} command="undo">↶</ToolbarCommandButton>
      <ToolbarCommandButton title={t('RICH_TEXT_REDO')} command="redo">↷</ToolbarCommandButton>
      <span className="rsw-separator" />
      <ToolbarCommandButton title={t('RICH_TEXT_BOLD')} command="bold"><strong>B</strong></ToolbarCommandButton>
      <ToolbarCommandButton title={t('RICH_TEXT_ITALIC')} command="italic"><em>I</em></ToolbarCommandButton>
      <ToolbarCommandButton title={t('RICH_TEXT_UNDERLINE')} command="underline"><u>U</u></ToolbarCommandButton>
      <ToolbarCommandButton title={t('RICH_TEXT_STRIKETHROUGH')} command="strikeThrough"><s>S</s></ToolbarCommandButton>
      <span className="rsw-separator" />
      <RichTextFormatSelect command="fontName" label={t('RICH_TEXT_FONT_FAMILY')} options={[
        { value: 'Arial', label: 'Arial' },
        { value: 'Verdana', label: 'Verdana' },
        { value: 'Georgia', label: 'Georgia' },
        { value: 'Times New Roman', label: 'Times New Roman' },
        { value: 'Courier New', label: 'Courier New' },
        { value: 'Trebuchet MS', label: 'Trebuchet MS' }
      ]} />
      <RichTextFormatSelect command="fontSize" label={t('RICH_TEXT_FONT_SIZE')} options={[
        { value: '1', label: '10 px' },
        { value: '2', label: '12 px' },
        { value: '3', label: '14 px' },
        { value: '4', label: '16 px' },
        { value: '5', label: '18 px' },
        { value: '6', label: '24 px' },
        { value: '7', label: '32 px' }
      ]} />
      <RichTextLinkButton label={t('RICH_TEXT_LINK')} promptLabel={t('RICH_TEXT_LINK_PROMPT')} />
      <span className="rsw-separator" />
      <ToolbarCommandButton title={t('RICH_TEXT_BULLET_LIST')} command="insertUnorderedList"><span aria-hidden="true">•</span></ToolbarCommandButton>
      <ToolbarCommandButton title={t('RICH_TEXT_NUMBERED_LIST')} command="insertOrderedList"><span aria-hidden="true">1.</span></ToolbarCommandButton>
      <span className="rsw-separator" />
      <InsertImageButton label={imageButtonLabel} uploadErrorLabel={imageUploadErrorLabel} onUploadImage={onUploadImage} onUploadingChange={onUploadingChange} />
      <ToolbarCommandButton title={t('RICH_TEXT_CLEAR_FORMATTING')} command="removeFormat"><span aria-hidden="true">T×</span></ToolbarCommandButton>
      <button className="rsw-btn rich-text-editor__toolbar-button rich-text-editor__mode-button" type="button" title={t('RICH_TEXT_EDIT_HTML')} aria-label={t('RICH_TEXT_EDIT_HTML')} onMouseDown={onHtmlModeMouseDown} onClick={onOpenHtmlMode}>
        <span aria-hidden="true">{'</>'}</span>
      </button>
    </Toolbar>
  )
}
