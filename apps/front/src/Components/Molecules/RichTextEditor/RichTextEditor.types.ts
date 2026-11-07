export type RichTextEditorProps = {
  id: string
  value: string
  onChange: (value: string) => void
  imageButtonLabel: string
  imageUploadErrorLabel: string
  onUploadImage: (file: File) => Promise<string>
  maxTextLength?: number
  placeholder?: string
}
