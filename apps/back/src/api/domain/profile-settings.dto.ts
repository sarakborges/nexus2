import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator'
import type { ProfileSettings } from '@nexus/common'

const ACTIVITY_TYPES = [
  'friend_connected',
  'profile_post',
  'community_created',
  'community_membership'
] as const

export class UpdateProfileSettingsDto implements Partial<ProfileSettings> {
  @IsOptional()
  @IsIn(['friends', 'everyone'])
  messageAudience?: 'friends' | 'everyone'

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ACTIVITY_TYPES, { each: true })
  publishActivityTypes?: ProfileSettings['publishActivityTypes']

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ACTIVITY_TYPES, { each: true })
  showFriendActivityTypes?: ProfileSettings['showFriendActivityTypes']
}
