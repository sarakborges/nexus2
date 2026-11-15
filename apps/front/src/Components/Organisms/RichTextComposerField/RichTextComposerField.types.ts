import type { RichTextEditorProps } from '@/Components/Organisms/RichTextEditor'

export type RichTextComposerFieldProps = Omit<RichTextEditorProps, 'id'> & {
  id: string
  label: string
}
