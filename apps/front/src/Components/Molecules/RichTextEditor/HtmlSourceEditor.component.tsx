import { renderHtmlSyntaxHighlight } from './HtmlSyntaxHighlight.component'

import { type UIEvent, useRef } from 'react'

type HtmlSourceEditorProps = {
  id: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function HtmlSourceEditor({
  id,
  value,
  onChange,
  disabled
}: HtmlSourceEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, value.split('\n').length)

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop
      highlightRef.current.scrollLeft = target.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = target.scrollTop
  }

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
          {renderHtmlSyntaxHighlight(value)}
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
