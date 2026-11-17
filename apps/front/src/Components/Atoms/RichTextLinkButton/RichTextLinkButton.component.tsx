import type { RichTextLinkButtonProps } from './RichTextLinkButton.types'
import { useRichTextLinkButton } from './useRichTextLinkButton'
import { Button } from '@/DesignSystem'

export function RichTextLinkButton({ label, promptLabel }: RichTextLinkButtonProps) {
  const { handleMouseDown } = useRichTextLinkButton({ promptLabel })

  return (
    <Button
      variation="transparent"
      className="rsw-btn rich-text-editor__toolbar-button"
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={handleMouseDown}
    >
      <span aria-hidden="true">↗</span>
    </Button>
  )
}
