import { Transform, Type } from 'class-transformer'
import { Equals, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { DEFAULT_PAGE_SIZE } from '@nexus/common'

export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1
  @Transform(() => DEFAULT_PAGE_SIZE) @Equals(DEFAULT_PAGE_SIZE) pageSize = DEFAULT_PAGE_SIZE
  @IsOptional() @IsIn(['all', 'staff', 'banned']) tab?: string
  @IsOptional() @IsString() actorProfileId?: string
}
export function paginate<T>(items: T[], query: PaginationDto) {
  const pageSize = DEFAULT_PAGE_SIZE
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, totalItems, totalPages }
}
