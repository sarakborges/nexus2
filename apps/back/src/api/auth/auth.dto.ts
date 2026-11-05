import { IsEmail, IsIn, IsString, MinLength, ValidateIf } from 'class-validator'

import type { UserPreferences } from '@nexus/common'

export class CredentialsDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(1)
  password!: string
}

export class SignUpDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string
}

export class RefreshDto {
  @IsString()
  refreshToken!: string
}

export class CurrentProfileDto {
  @IsString()
  profileId!: string
}

export class PreferencesDto implements Partial<UserPreferences> {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['system', 'pt-BR', 'en-US'])
  language?: UserPreferences['language']

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['system', 'light', 'dark'])
  theme?: UserPreferences['theme']
}
