import { RichTextEditor } from '@/Components/Molecules/RichTextEditor'
import { Label } from '@/DesignSystem'

import type { RichTextComposerFieldProps } from './RichTextComposerField.types'

export function RichTextComposerField({
  id,
  label,
  ...editorProps
}: RichTextComposerFieldProps) {
  return (
    <div className="form-field">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      <RichTextEditor id={id} {...editorProps} />
    </div>
  )
}
