import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { CommunityEditPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { normalizeEntityUrl } from './domain.utils'

@Injectable()
export class CommunityEditPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getCommunityEditPage(url: string, userId: string | null): Promise<CommunityEditPageData> {
    return this.data.getCommunityEditPage(normalizeEntityUrl(url), userId).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      throw error
    })
  }
}
