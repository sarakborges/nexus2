import { Fragment } from 'react'

import type {
  HtmlSyntaxAttributePart,
  HtmlSyntaxHighlightProps
} from './HtmlSyntaxHighlight.types'
import { tokenizeHtml } from './htmlSyntaxHighlight.utils'

const tokenClassNames = {
  comment: 'rich-text-editor__token--comment',
  entity: 'rich-text-editor__token--entity',
  doctype: 'rich-text-editor__token--doctype',
  tag: 'rich-text-editor__token--tag',
  name: 'rich-text-editor__token--name',
  attribute: 'rich-text-editor__token--attribute',
  punctuation: 'rich-text-editor__token--punctuation',
  string: 'rich-text-editor__token--string'
} as const

function AttributePart({ part }: { part: HtmlSyntaxAttributePart }) {
  if (part.type === 'text') return <>{part.value}</>

  return (
    <span className={`rich-text-editor__token ${tokenClassNames[part.type]}`}>
      {part.value}
    </span>
  )
}

export function HtmlSyntaxHighlight({ source }: HtmlSyntaxHighlightProps) {
  const tokens = tokenizeHtml(source)

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <Fragment key={index}>{token.value}</Fragment>
        }

        if (token.type === 'tag') {
          return (
            <Fragment key={index}>
              <span className={`rich-text-editor__token ${tokenClassNames.tag}`}>
                {token.opening}
              </span>
              <span className={`rich-text-editor__token ${tokenClassNames.name}`}>
                {token.name}
              </span>
              {token.attributes.map((part, partIndex) => (
                <AttributePart key={partIndex} part={part} />
              ))}
              <span className={`rich-text-editor__token ${tokenClassNames.tag}`}>
                {token.closing}
              </span>
            </Fragment>
          )
        }

        const tokenType = token.type === 'tag-text' ? 'tag' : token.type
        return (
          <span
            className={`rich-text-editor__token ${tokenClassNames[tokenType]}`}
            key={index}
          >
            {token.value}
          </span>
        )
      })}
    </>
  )
}
