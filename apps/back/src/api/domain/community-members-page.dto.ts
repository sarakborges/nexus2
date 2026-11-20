import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

import { MAX_PAGE_NUMBER } from '../pagination/pagination.constants'
import { PaginationDto } from '../pagination/pagination.dto'

export class CommunityMembersPageDto extends PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_NUMBER)
  pendingPage = 1
}
