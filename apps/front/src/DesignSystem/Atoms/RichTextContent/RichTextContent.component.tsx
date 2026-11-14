import type { RichTextContentProps } from './RichTextContent.types'
import './RichTextContent.style.scss'
export function RichTextContent({ html, className, ...props }: RichTextContentProps) {
  return <div {...props} className={['rich-text-content', className].filter(Boolean).join(' ')} dangerouslySetInnerHTML={{ __html: html }} />
}
