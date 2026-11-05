export type HtmlSyntaxHighlightProps = {
  source: string
}

export type HtmlSyntaxAttributePart = {
  type: 'text' | 'attribute' | 'punctuation' | 'string'
  value: string
}

export type HtmlSyntaxToken =
  | { type: 'text' | 'comment' | 'entity' | 'doctype' | 'tag-text'; value: string }
  | {
      type: 'tag'
      opening: string
      name: string
      attributes: HtmlSyntaxAttributePart[]
      closing: string
    }
