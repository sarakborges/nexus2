import './HtmlSourceEditor.style.scss'
import type { HtmlSourceEditorProps } from './HtmlSourceEditor.types'
import { HtmlSyntaxHighlight } from '@/Components/Molecules/HtmlSyntaxHighlight'
import { useHtmlSourceEditor } from './useHtmlSourceEditor'

export function HtmlSourceEditor({
  id,
  value,
  onChange,
  disabled
}: HtmlSourceEditorProps) {
  const { highlightRef, gutterRef, lineCount, syncScroll } = useHtmlSourceEditor({ value })

  return (
    <div className="rich-text-editor__html-editor">
      <div
        ref={gutterRef}
        className="rich-text-editor__line-numbers"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
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
          aria-label="HTML source editor"
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
