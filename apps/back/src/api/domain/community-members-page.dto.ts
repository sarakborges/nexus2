import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

import { PaginationDto } from '../pagination/pagination.dto'

export class CommunityMembersPageDto extends PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pendingPage = 1
}
