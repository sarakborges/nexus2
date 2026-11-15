import type { ProfileSettings } from '@nexus/common'

function haveSameValues<T>(left: readonly T[], right: readonly T[]): boolean {
  const leftValues = new Set(left)
  const rightValues = new Set(right)

  return (
    leftValues.size === rightValues.size &&
    [...leftValues].every(value => rightValues.has(value))
  )
}

export function areProfileSettingsEquivalent(
  left: ProfileSettings,
  right: ProfileSettings
): boolean {
  return (
    left.messageAudience === right.messageAudience &&
    haveSameValues(left.publishActivityTypes, right.publishActivityTypes) &&
    haveSameValues(left.showFriendActivityTypes, right.showFriendActivityTypes)
  )
}
