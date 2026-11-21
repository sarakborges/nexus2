import { Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
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

export class IdsQueryDto {
  @Transform(({ value }) => value === undefined ? [] : Array.isArray(value) ? value : [value])
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ids: string[] = []
}

export class SearchDto extends PaginationDto {
  @IsString()
  @MaxLength(120)
  query = ''

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
  @MaxLength(2048)
  url?: string

  @IsString()
  @MaxLength(2048)
  picture!: string

  @IsString()
  @MaxLength(8000)
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
  @MaxLength(2048)
  url?: string

  @IsString()
  @MaxLength(2048)
  picture!: string

  @IsString()
  @MaxLength(8000)
  about!: string
}

export class CreateCommunityDto implements CreateCommunityInput {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string

  @IsString()
  @MaxLength(2048)
  picture!: string

  @IsString()
  @MaxLength(8000)
  about!: string

  @IsIn(['public', 'private', 'unlisted'])
  privacy!: CommunityPrivacy

  @IsUUID()
  ownerProfileId!: string
}

export class UpdateCommunityDto implements CreateCommunityInput {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string

  @IsString()
  @MaxLength(2048)
  picture!: string

  @IsString()
  @MaxLength(8000)
  about!: string

  @IsIn(['public', 'private', 'unlisted'])
  privacy!: CommunityPrivacy
}

export class RemoveProfileRelationDto {
  @IsUUID()
  sourceProfileId!: string

  @IsUUID()
  targetProfileId!: string
}

export class ProfileRelationDto {
  @IsUUID()
  sourceProfileId!: string

  @IsUUID()
  targetProfileId!: string

  @IsIn(['connection', 'requested', 'blocked'])
  type!: RelationshipType
}

export class CommunityRelationDto {
  @IsUUID()
  actorProfileId!: string

  @IsIn(['connection', 'requested', 'blocked', 'moderator'])
  type!: CommunityRelationshipType
}

export class ActorDto {
  @IsUUID()
  actorProfileId!: string
}

export class OwnershipDto extends ActorDto {
  @IsUUID()
  newOwnerProfileId!: string
}

export class MessageDto {
  @IsUUID()
  fromProfileId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string
}

export class CreateForumTopicDto {
  @IsUUID()
  profileId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  title!: string

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string
}

export class CreateForumReplyDto {
  @IsUUID()
  profileId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string
}

export class ForumActorDto {
  @IsUUID()
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

export class ProfileMessagesPageDto extends PaginationDto {
  @IsOptional()
  @IsIn(['all', 'favorites'])
  messageTab: 'all' | 'favorites' = 'all'
}

export class CommunitiesPageDto extends PaginationDto {
  @IsOptional()
  @IsIn(['all', 'managed'])
  communityTab: 'all' | 'managed' = 'all'
}

export class ProfileMessageFavoriteDto extends ActorDto {
  @IsBoolean()
  isFavorite!: boolean
}

export class ProfilePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string
}
