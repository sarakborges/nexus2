import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

import type { UploadPurpose } from './uploads.types'

export class CreateUploadDto {
  @IsIn(['profile-avatar', 'community-avatar', 'editor-image'])
  purpose!: UploadPurpose

  @IsString()
  contentType!: string

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size!: number

  @IsOptional()
  @IsString()
  targetId?: string

  @IsOptional()
  @IsString()
  actorProfileId?: string
}

export class UpdateAvatarDto {
  @IsOptional()
  @IsString()
  uploadId?: string | null

  @IsOptional()
  @IsString()
  actorProfileId?: string
}
