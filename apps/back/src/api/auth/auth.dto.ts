import { IsEmail, IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator'

import type { UserPreferences } from '@nexus/common'

export class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string
}

export class SignUpDto {
  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string
}

export class RefreshDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  refreshToken!: string
}

export class CurrentProfileDto {
  @IsUUID()
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
