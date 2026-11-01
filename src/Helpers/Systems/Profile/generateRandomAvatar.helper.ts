import { AVATAR_OPTIONS } from '@/Consts/Avatars.const'

export const generateRandomAvatar = () => {
  return {
    hairColor:
      AVATAR_OPTIONS.hairColor[
        Math.floor(Math.random() * AVATAR_OPTIONS.hairColor.length)
      ],

    hairStyle:
      AVATAR_OPTIONS.hair[
        Math.floor(Math.random() * AVATAR_OPTIONS.hair.length)
      ],

    skinColor:
      AVATAR_OPTIONS.skin[
        Math.floor(Math.random() * AVATAR_OPTIONS.skin.length)
      ]
  }
}
