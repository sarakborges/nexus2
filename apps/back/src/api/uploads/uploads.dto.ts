import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator'

import { IMAGE_MAX_FILE_SIZE } from './uploads.constants'
import type { UploadPurpose } from './uploads.types'

export class CreateUploadDto {
  @IsIn(['profile-avatar', 'community-avatar', 'editor-image'])
  purpose!: UploadPurpose

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contentType!: string

  @IsInt()
  @Min(1)
  @Max(IMAGE_MAX_FILE_SIZE)
  size!: number

  @IsOptional()
  @IsUUID()
  targetId?: string

  @IsOptional()
  @IsUUID()
  actorProfileId?: string
}

export class UpdateAvatarDto {
  @IsOptional()
  @IsUUID()
  uploadId?: string | null

  @IsOptional()
  @IsUUID()
  actorProfileId?: string
}
