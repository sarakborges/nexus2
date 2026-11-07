import { useRef } from 'react'

import type {
  UseHtmlSourceEditorController,
  UseHtmlSourceEditorOptions
} from './useHtmlSourceEditor.types'

export function useHtmlSourceEditor({
  value
}: UseHtmlSourceEditorOptions): UseHtmlSourceEditorController {
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, value.split('\n').length)

  const syncScroll: UseHtmlSourceEditorController['syncScroll'] = event => {
    const target = event.currentTarget
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop
      highlightRef.current.scrollLeft = target.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = target.scrollTop
  }

  return { highlightRef, gutterRef, lineCount, syncScroll }
}
