import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class ActivityFeedPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cursorUpdatedAt?: number

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  cursorId?: string
}
