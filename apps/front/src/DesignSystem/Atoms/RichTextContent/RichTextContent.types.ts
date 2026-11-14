import type { HTMLAttributes } from 'react'

export type RichTextContentProps = {
  html: string
} & Omit<HTMLAttributes<HTMLDivElement>, 'dangerouslySetInnerHTML'>
