import type {
  HtmlSyntaxAttributePart,
  HtmlSyntaxToken
} from './HtmlSyntaxHighlight.types'

const htmlTokenPattern =
  /<!--[\s\S]*?-->|<!doctype\b[^>]*>|<\/?[A-Za-z][^>]*>|&(?:#\d+|#x[\da-f]+|[A-Za-z][\w]+);/gi

const tagPattern = /^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/
const attributePattern =
  /([A-Za-z_:][\w:.-]*)(\s*=\s*)((?:"[^"]*")|(?:'[^']*')|(?:[^\s>]+))/g

function tokenizeTag(tag: string): HtmlSyntaxToken {
  const match = tag.match(tagPattern)
  if (!match) return { type: 'tag-text', value: tag }

  const [, opening, name, rawAttributes, closing] = match
  const attributes: HtmlSyntaxAttributePart[] = []
  let cursor = 0

  for (const attribute of rawAttributes.matchAll(attributePattern)) {
    const start = attribute.index ?? 0
    if (start > cursor) {
      attributes.push({
        type: 'text',
        value: rawAttributes.slice(cursor, start)
      })
    }

    attributes.push(
      { type: 'attribute', value: attribute[1] },
      { type: 'punctuation', value: attribute[2] },
      { type: 'string', value: attribute[3] }
    )
    cursor = start + attribute[0].length
  }

  if (cursor < rawAttributes.length) {
    attributes.push({
      type: 'text',
      value: rawAttributes.slice(cursor)
    })
  }

  return { type: 'tag', opening, name, attributes, closing }
}

export function tokenizeHtml(source: string): HtmlSyntaxToken[] {
  const tokens: HtmlSyntaxToken[] = []
  let cursor = 0

  for (const match of source.matchAll(htmlTokenPattern)) {
    const start = match.index ?? 0
    if (start > cursor) {
      tokens.push({ type: 'text', value: source.slice(cursor, start) })
    }

    const token = match[0]
    if (token.startsWith('<!--')) {
      tokens.push({ type: 'comment', value: token })
    } else if (token.startsWith('&')) {
      tokens.push({ type: 'entity', value: token })
    } else if (/^<!doctype/i.test(token)) {
      tokens.push({ type: 'doctype', value: token })
    } else {
      tokens.push(tokenizeTag(token))
    }

    cursor = start + token.length
  }

  if (cursor < source.length) {
    tokens.push({ type: 'text', value: source.slice(cursor) })
  }
  if (source.endsWith('\n')) {
    tokens.push({ type: 'text', value: '\u200b' })
  }

  return tokens
}
