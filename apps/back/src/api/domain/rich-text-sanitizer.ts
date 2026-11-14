import sanitizeHtml = require('sanitize-html')

const colorValue = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/]+\)|[a-z]{1,20})$/i

const allowedStyles: NonNullable<sanitizeHtml.IOptions['allowedStyles']> = {
  '*': {
    color: [colorValue],
    'background-color': [colorValue],
    'font-size': [/^(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger|(?:0|[1-9]\d?)(?:\.\d+)?(?:px|pt|em|rem|%)?)$/i],
    'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i],
    'font-family': [/^(?:Arial|Verdana|Georgia|Times New Roman|Courier New|Trebuchet MS|sans-serif|serif|monospace)$/i],
    'font-style': [/^(?:normal|italic|oblique)$/i],
    'text-decoration': [/^(?:none|underline|line-through|overline)$/i],
    'text-align': [/^(?:left|right|center|justify|start|end)$/i],
    'line-height': [/^(?:normal|(?:0|[1-5](?:\.\d+)?)(?:px|pt|em|rem|%)?)$/i],
    'vertical-align': [/^(?:baseline|sub|super|top|middle|bottom|text-top|text-bottom)$/i],
    'text-transform': [/^(?:none|capitalize|uppercase|lowercase)$/i],
    'white-space': [/^(?:normal|pre|pre-wrap|pre-line|nowrap)$/i]
  }
}

const legacyFontSizes: Record<string, string> = {
  '1': '10px',
  '2': '12px',
  '3': '14px',
  '4': '16px',
  '5': '18px',
  '6': '24px',
  '7': '32px'
}

const allowedFontFamilies = new Map([
  ['arial', 'Arial'],
  ['verdana', 'Verdana'],
  ['georgia', 'Georgia'],
  ['times new roman', 'Times New Roman'],
  ['courier new', 'Courier New'],
  ['trebuchet ms', 'Trebuchet MS']
])

const sanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'font',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
    'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong',
    'sub', 'sup', 'u', 'ul'
  ],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'title'],
    font: ['face', 'size'],
    img: ['src', 'alt', 'title']
  },
  allowedStyles,
  transformTags: {
    font: (_tagName, attributes) => {
      const styles: string[] = []
      const family = attributes.face?.trim().toLowerCase()
      const safeFamily = family ? allowedFontFamilies.get(family) : undefined
      const size = attributes.size ? legacyFontSizes[attributes.size] : undefined

      if (safeFamily) styles.push(`font-family:${safeFamily}`)
      if (size) styles.push(`font-size:${size}`)

      const attribs: Record<string, string> = {}
      if (styles.length) attribs.style = styles.join(';')

      return {
        tagName: 'span',
        attribs
      }
    }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https']
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: [
    'style', 'script', 'textarea', 'option', 'xmp',
    'iframe', 'object', 'embed', 'svg', 'math', 'template',
    'noscript', 'noembed', 'noframes'
  ],
  nestingLimit: 20
}

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(typeof value === 'string' ? value : '', sanitizerOptions).trim()
}

export function getRichTextPlainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim()
}
