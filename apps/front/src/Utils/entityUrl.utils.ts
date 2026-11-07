export function normalizeEntityUrl(url?: string): string {
  return url?.trim().replace(/^@/, '').toLowerCase() ?? ''
}
