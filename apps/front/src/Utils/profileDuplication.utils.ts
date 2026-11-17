import type { Profile } from '@nexus/common'

export type ProfileDuplicationLocationState = {
  duplicateProfile: Pick<Profile, 'name' | 'url' | 'picture' | 'about' | 'type'>
  duplicateMediaOmitted: boolean
}

export function getProfileDuplicationLocationState(
  profile: Profile
): ProfileDuplicationLocationState {
  const duplicateAbout = profile.about.replace(
    /<img\b(?=[^>]*\bsrc=(["'])[^"']*\/api\/uploads\/[0-9a-f-]{36}\/content\1)[^>]*>/gi,
    ''
  )
  const hasManagedAvatar = profile.picture.includes(
    '/storage/v1/object/public/nexus-avatars/'
  )

  return {
    duplicateProfile: {
      name: profile.name,
      url: profile.url + '-copy',
      picture: hasManagedAvatar ? '' : profile.picture,
      about: duplicateAbout,
      type: profile.type
    },
    duplicateMediaOmitted: Boolean(
      hasManagedAvatar || duplicateAbout !== profile.about
    )
  }
}
