import './HtmlSourceEditor.style.scss'
import type { HtmlSourceEditorProps } from './HtmlSourceEditor.types'
import { HtmlSyntaxHighlight } from '@/Components/Atoms/HtmlSyntaxHighlight'
import { LineNumberGutter } from '@/Components/Atoms/LineNumberGutter'
import { useHtmlSourceEditor } from './useHtmlSourceEditor'

export function HtmlSourceEditor({
  id,
  ariaLabel,
  value,
  onChange,
  disabled
}: HtmlSourceEditorProps) {
  const { highlightRef, gutterRef, lineCount, syncScroll } = useHtmlSourceEditor({ value })

  return (
    <div className="rich-text-editor__html-editor">
      <LineNumberGutter ref={gutterRef} lineCount={lineCount} />
      <div className="rich-text-editor__code-surface">
        <pre
          ref={highlightRef}
          className="rich-text-editor__highlight"
          aria-hidden="true"
        >
          <HtmlSyntaxHighlight source={value} />
        </pre>
        <textarea
          id={id + '-html-source'}
          className="rich-text-editor__html-source"
          aria-label={ariaLabel}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          wrap="off"
        />
      </div>
    </div>
  )
}
