import { Fragment, type ReactNode } from 'react'

import type { HtmlSyntaxHighlightProps } from './HtmlSyntaxHighlight.types'

function highlightTag(tag: string, key: number): ReactNode {
  const match = tag.match(/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/)
  if (!match) {
    return (
      <span
        className="rich-text-editor__token rich-text-editor__token--tag"
        key={key}
      >
        {tag}
      </span>
    )
  }

  const [, opening, name, rawAttributes, closing] = match
  const attributes: ReactNode[] = []
  const attributePattern =
    /([A-Za-z_:][\w:.-]*)(\s*=\s*)((?:"[^"]*")|(?:'[^']*')|(?:[^\s>]+))/g
  let cursor = 0
  let attributeIndex = 0

  for (const attribute of rawAttributes.matchAll(attributePattern)) {
    const start = attribute.index ?? 0
    if (start > cursor) {
      attributes.push(rawAttributes.slice(cursor, start))
    }

    attributes.push(
      <Fragment key={attributeIndex++}>
        <span className="rich-text-editor__token rich-text-editor__token--attribute">
          {attribute[1]}
        </span>
        <span className="rich-text-editor__token rich-text-editor__token--punctuation">
          {attribute[2]}
        </span>
        <span className="rich-text-editor__token rich-text-editor__token--string">
          {attribute[3]}
        </span>
      </Fragment>
    )
    cursor = start + attribute[0].length
  }

  if (cursor < rawAttributes.length) {
    attributes.push(rawAttributes.slice(cursor))
  }

  return (
    <Fragment key={key}>
      <span className="rich-text-editor__token rich-text-editor__token--tag">
        {opening}
      </span>
      <span className="rich-text-editor__token rich-text-editor__token--name">
        {name}
      </span>
      {attributes}
      <span className="rich-text-editor__token rich-text-editor__token--tag">
        {closing}
      </span>
    </Fragment>
  )
}

export function HtmlSyntaxHighlight({ source }: HtmlSyntaxHighlightProps) {
  const pattern =
    /<!--[\s\S]*?-->|<!doctype\b[^>]*>|<\/?[A-Za-z][^>]*>|&(?:#\d+|#x[\da-f]+|[A-Za-z][\w]+);/gi
  const pieces: ReactNode[] = []
  let cursor = 0
  let key = 0

  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) pieces.push(source.slice(cursor, start))

    const token = match[0]
    if (token.startsWith('<!--')) {
      pieces.push(
        <span
          className="rich-text-editor__token rich-text-editor__token--comment"
          key={key++}
        >
          {token}
        </span>
      )
    } else if (token.startsWith('&')) {
      pieces.push(
        <span
          className="rich-text-editor__token rich-text-editor__token--entity"
          key={key++}
        >
          {token}
        </span>
      )
    } else if (/^<!doctype/i.test(token)) {
      pieces.push(
        <span
          className="rich-text-editor__token rich-text-editor__token--doctype"
          key={key++}
        >
          {token}
        </span>
      )
    } else {
      pieces.push(highlightTag(token, key++))
    }

    cursor = start + token.length
  }

  if (cursor < source.length) pieces.push(source.slice(cursor))
  if (source.endsWith('\n')) pieces.push('\u200b')

  return <>{pieces}</>
}
