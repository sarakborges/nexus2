import type { UIEvent } from 'react'
import type { HtmlSourceEditorProps } from './HtmlSourceEditor.types'

export type UseHtmlSourceEditorOptions = Pick<HtmlSourceEditorProps, 'value'>

export type UseHtmlSourceEditorController = {
  highlightRef: { current: HTMLPreElement | null }
  gutterRef: { current: HTMLDivElement | null }
  lineCount: number
  syncScroll: (event: UIEvent<HTMLTextAreaElement>) => void
}
