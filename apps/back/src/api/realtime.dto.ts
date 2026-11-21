import { IsInt, IsString, IsUUID, Matches, Max, Min } from 'class-validator'

export class VerifyRealtimeEventDto {
  @IsUUID()
  topicId!: string

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  changedAt!: number

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  signature!: string
}
