export function normalizeEntityUrl(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getNewEditorImages(html: string, previousHtml: string): string {
  const pattern = /<img\b[^>]*\bsrc=(["'])\/api\/uploads\/([0-9a-f-]{36})\/content\1/gi
  const previousIds = new Set([...previousHtml.matchAll(pattern)].map(match => match[2]))
  const newIds = [...html.matchAll(pattern)]
    .map(match => match[2])
    .filter((id, index, ids) => !previousIds.has(id) && ids.indexOf(id) === index)
  return newIds.map(id => '<img src="/api/uploads/' + id + '/content">').join('')
}
