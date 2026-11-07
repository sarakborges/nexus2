import { Transform, Type } from 'class-transformer'
import { Equals, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

import { FIXED_PAGE_SIZE } from './pagination.constants'

export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @Transform(() => FIXED_PAGE_SIZE)
  @Equals(FIXED_PAGE_SIZE)
  pageSize = FIXED_PAGE_SIZE

  @IsOptional()
  @IsIn(['all', 'staff', 'banned'])
  tab?: string

  @IsOptional()
  @IsString()
  actorProfileId?: string
}
