import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Res,
  UseGuards
} from '@nestjs/common'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAccessGuard, OptionalJwtAccessGuard } from '../auth/jwt-access.guard'
import { UploadsService, type UploadPurpose } from './uploads.service'

class CreateUploadDto {
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

class UpdateAvatarDto {
  @IsOptional()
  @IsString()
  uploadId?: string | null

  @IsOptional()
  @IsString()
  actorProfileId?: string
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  @UseGuards(JwtAccessGuard)
  createUpload(@CurrentUser() user: { id: string }, @Body() body: CreateUploadDto) {
    return this.uploads.createUpload(user.id, body)
  }

  @Post(':id/complete')
  @UseGuards(JwtAccessGuard)
  completeUpload(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.uploads.completeUpload(user.id, id)
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard)
  async deleteUpload(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.uploads.deleteUpload(user.id, id)
    return { success: true }
  }

  @Get(':id/content')
  @UseGuards(OptionalJwtAccessGuard)
  async getContent(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
    @Res() response: Response
  ) {
    const file = await this.uploads.getEditorImage(user?.id ?? null, id)
    response.setHeader('Content-Type', file.contentType)
    response.setHeader('Content-Length', String(file.body.byteLength))
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.send(file.body)
  }

  @Patch('profiles/:profileId/avatar')
  @UseGuards(JwtAccessGuard)
  setProfileAvatar(
    @CurrentUser() user: { id: string },
    @Param('profileId') profileId: string,
    @Body() body: UpdateAvatarDto
  ) {
    return this.uploads.setProfileAvatar(user.id, profileId, body.uploadId ?? null)
  }

  @Patch('communities/:communityId/avatar')
  @UseGuards(JwtAccessGuard)
  setCommunityAvatar(
    @CurrentUser() user: { id: string },
    @Param('communityId') communityId: string,
    @Body() body: UpdateAvatarDto
  ) {
    if (!body.actorProfileId) throw new BadRequestException('ACTOR_PROFILE_REQUIRED')
    return this.uploads.setCommunityAvatar(user.id, communityId, body.actorProfileId, body.uploadId ?? null)
  }
}

@Controller('internal')
export class UploadsInternalController {
  constructor(private readonly uploads: UploadsService) {}

  @Get('cleanup-uploads')
  cleanup(@Headers('x-nexus-cron-secret') secret?: string) {
    return this.uploads.cleanupExpired(secret)
  }
}
