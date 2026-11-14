export type RichTextFormatCommand = 'fontName' | 'fontSize'
export type RichTextFormatOption = { value: string; label: string }
export type RichTextFormatSelectProps = {
  command: RichTextFormatCommand
  label: string
  options: RichTextFormatOption[]
}
