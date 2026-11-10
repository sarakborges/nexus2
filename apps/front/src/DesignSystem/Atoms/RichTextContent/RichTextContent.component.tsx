import type { HTMLAttributes } from 'react'
import './RichTextContent.style.scss'
export type RichTextContentProps = { html: string } & Omit<HTMLAttributes<HTMLDivElement>, 'dangerouslySetInnerHTML'>
export function RichTextContent({ html, className, ...props }: RichTextContentProps) {
  return <div {...props} className={['rich-text-content', className].filter(Boolean).join(' ')} dangerouslySetInnerHTML={{ __html: html }} />
}
