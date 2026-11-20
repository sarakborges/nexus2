import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

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
