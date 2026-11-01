import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20
}
export function paginate<T>(items: T[], query: PaginationDto) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * query.pageSize
  return { items: items.slice(start, start + query.pageSize), page, pageSize: query.pageSize, totalItems, totalPages }
}
