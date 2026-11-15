import type { RichTextEditorProps } from '@/Components/Molecules/RichTextEditor'

export type RichTextComposerFieldProps = Omit<RichTextEditorProps, 'id'> & {
  id: string
  label: string
}
