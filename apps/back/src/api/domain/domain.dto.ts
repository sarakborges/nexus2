import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'
import { PaginationDto } from '../pagination/pagination.dto'

import type {
  CommunityPrivacy,
  CommunityRelationshipType,
  CreateCommunityInput,
  CreateProfileInput,
  RelationshipType,
  SearchScope
} from '@nexus/common'

export class SearchDto extends PaginationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  query!: string

  @IsOptional()
  @IsIn(['all', 'profiles', 'communities'])
  scope: SearchScope = 'all'
}

export class CreateProfileDto implements CreateProfileInput {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsOptional()
  @IsString()
  url?: string

  @IsString()
  picture!: string

  @IsString()
  @MaxLength(12000)
  about!: string

  @IsIn(['social', 'rp', 'business'])
  type!: 'social' | 'rp' | 'business'
}

export class UpdateProfileDto implements Omit<CreateProfileInput, 'type'> {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsOptional()
  @IsString()
  url?: string

  @IsString()
  picture!: string

  @IsString()
  @MaxLength(12000)
  about!: string
}

export class CreateCommunityDto implements CreateCommunityInput {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsOptional()
  @IsString()
  url?: string

  @IsString()
  picture!: string

  @IsString()
  @MaxLength(12000)
  about!: string

  @IsIn(['public', 'private', 'unlisted'])
  privacy!: CommunityPrivacy

  @IsString()
  ownerProfileId!: string
}

export class UpdateCommunityDto implements CreateCommunityInput {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsOptional()
  @IsString()
  url?: string

  @IsString()
  picture!: string

  @IsString()
  @MaxLength(12000)
  about!: string

  @IsIn(['public', 'private', 'unlisted'])
  privacy!: CommunityPrivacy
}

export class ProfileRelationDto {
  @IsString()
  sourceProfileId!: string

  @IsString()
  targetProfileId!: string

  @IsIn(['connection', 'requested', 'blocked'])
  type!: RelationshipType
}

export class CommunityRelationDto {
  @IsString()
  actorProfileId!: string

  @IsIn(['connection', 'requested', 'blocked', 'moderator'])
  type!: CommunityRelationshipType
}

export class ActorDto {
  @IsString()
  actorProfileId!: string
}

export class OwnershipDto extends ActorDto {
  @IsString()
  newOwnerProfileId!: string
}

export class MessageDto {
  @IsString()
  fromProfileId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string
}

export class CreateForumTopicDto {
  @IsString()
  profileId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  title!: string

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string
}

export class CreateForumReplyDto {
  @IsString()
  profileId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string
}

export class ForumActorDto {
  @IsString()
  profileId!: string
}

export class ForumModerationDto extends ForumActorDto {
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean
}
