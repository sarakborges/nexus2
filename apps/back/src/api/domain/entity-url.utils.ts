export function getEntityUrlCandidate(baseUrl: string, attempt: number): string {
  return attempt <= 1 ? baseUrl : `${baseUrl}-${attempt}`
}

export function isEntityUrlAlreadyInUse(
  error: unknown,
  entity: 'profile' | 'community'
): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const domainCode = entity === 'profile'
    ? 'PROFILE_URL_ALREADY_IN_USE'
    : 'COMMUNITY_URL_ALREADY_IN_USE'
  const constraintName = entity === 'profile'
    ? 'profiles_url_key'
    : 'communities_url_key'

  return message.includes(domainCode) || message.includes(constraintName)
}
